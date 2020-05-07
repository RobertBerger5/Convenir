var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fetch = require("node-fetch");
var request = require('request');

//sessions expire after this amount of time (1 hour in milliseconds)
const MAX_TIME = 3600000;

//Google Places API key
const apiKey = 'AIzaSyDAuZt7d6V0zQn72hH7aSYT6HbhXwFyTSo';


//don't need this with React-Native, but it really helps with testing
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/test.html');
});

/*TODO:
	start vote? 50% of room wants start -> start
*/

//like an enum, but everything is a hash map kinda thing in JS
const status = {
	CREATED: 'created',
	READY: 'ready',
	SWIPING: 'swiping'
}
/*global hash map for rooms with the key being the room id and value as object:
	people = number of people
	type = type of room (restaurant, bar, etc.)
	status = one of the values in the status object
	results = return of the search API (initialized to null)
*/
var rooms = {};

/*TYPES OF EVENTS SENT BY THE SERVER:
	user_err: lets the user know they did something wrong and nothing happened on the server
	message: gives the user some info on what happened on the server
	created: creation successful, sends room id
	join_ack: successfully joined room (no string sent with it)
	other_joined: notification that someone joined (including the person themselves), sends number of people in room now
	leave_ack: all clear, user has left succesfully (no string sent with it)
	other_left: notification that someone else left, sends number of people in room now
	started: all clear, begin swiping (no string sent with it)
	ended: an hour has passed and the room has closed, everyone will be booted (can't figure out how to do that server-side, so politely request that the client boot themselves)
	results: results from API call, sent ASAP on create or join
	swipe_ack: swipe successful, take that restaurant out of the pile
	vote_update: TBD, depending on if we want the "top results" to be calculated server-side or client-side
*/

/*TYPES OF EVENTS THE SERVER EXPECTS:
	create: user creates a room, sends them the room id to tell their friends (if successful)
	join: user joins a room, sends them how many others are in the room, as well as the API results (if successful)
	start: user starts the room, sends back an acknowledgement that they may begin swiping (if successful)
	leave: user leaves the room, sends back acknowledgement to that user that they left the room, and a notice to other users that someone left (if successful)
	swipe: user has swiped, doesn't send anything back at the moment

	disconnect: user has disconnected, socket.io sends this automatically
*/

io.on('connection', (socket) => {
	console.log('user connected');
	//start without a room by default. Also, users are only ever in one room at a time
	socket.mainRoom = null;

	//request to create a room
	socket.on('create', (type) => {
		if (socket.mainRoom != null) {
			socket.emit('user_err', 'Cannot create a room while in one');
			console.log("(someone tried to create a room while already in one)");
			return;
		}

		//room id
		let id = null;
		do {
			//generate an id unique to the millisecond
			id = (Date.now() % MAX_TIME).toString(36);
		} while (id in rooms);//and keep trying if it already exists
		//(worst case: people wait while we create one new room per millisecond, which shouldn't be bad at all unless we get VERY popular)

		//assert: id is not already a key in rooms (and node.js is a single thread, so no one could've taken that id in the meantime)
		socket.join(id); //socket.io join room
		socket.mainRoom = id; //so we know which room they belong to
		//initialize the room
		rooms[id] = { people: 1, type: type, status: status.CREATED, results: null };
		socket.emit('created', id);
		console.log("room created with id: " + id);

		setTimeout(() => {
			if (id in rooms) {
				io.to(id).emit('ended');
				//TODO: figure out how to boot em all
				//delete rooms[id];
				//console.log("deleting room " + id);
			}
			console.log("time limit exceeded for room " + id + ", everyone booted (boot themselves)");
		}, MAX_TIME);

		//SEARCH for the API call
		getResults(id, socket, 'restaurant', '44.4583', '-93.1616', '5000'); //emits 'results' with API results back to room creator
	});

	//request to join a room
	socket.on('join', (id) => {
		if (socket.mainRoom != null) {
			socket.emit('user_err', 'Cannot join another room');
			console.log("(someone tried to join a room while already in one)");
			return;
		}
		if (!(id in rooms)) {
			socket.emit('user_err', 'Room "' + id + '" not found');
			console.log("(someone tried to join a room that doesn't exist)");
			return;
		}
		if (rooms[id].status == status.SWIPING) {
			socket.emit('user_err', 'Room is already swiping, cannot join');
			console.log("(someone tried to join a room that was already swiping");
			return;
		}

		socket.join(id);//subscribe to socket.io room
		socket.mainRoom = id;//so we know which room they belong to
		rooms[id].people++;//one more person in
		socket.emit('join_ack');//send only to new user
		io.to(id).emit('other_joined', rooms[id].people);//send to all, including new user
		console.log("user joined room " + id);

		//send them the results to load in
		socket.emit('results', rooms[id].results);
	});

	socket.on('start', () => {
		let id = socket.mainRoom;
		if (id == null) {
			socket.emit('user_err', 'Need to be in a room to start session');
			console.log("(someone tried to start while not in a session)");
			return;
		} else if (rooms[id].status != status.READY) {
			socket.emit('user_err', 'Cannot start session now');
			console.log("(someone either tried to start the room when the room was still loading, or when it was already started)");
			return;
		}
		//let everyone know that the session has started
		rooms[id].status = status.SWIPING;
		io.to(socket.mainRoom).emit('started');
	});

	socket.on('leave', () => {
		//could disallow them to leave while the room status is "swiping", but we can't stop them from disconnecting
		leaveRoom(socket);
	});

	socket.on('disconnect', () => {
		leaveRoom(socket);
	});

	//API results returned to user, and they're making choices
	socket.on('swipe', (locI, swipe) => {
		//user swiped {swipe} on {results.candidates[locI]}
		//very minimal at the moment, doesn't even check if they're in a room and that the room has searched / has results
		let id = socket.mainRoom;
		if (id == null) {
			socket.emit('user_err', 'Cannot swipe without being in a room');
			console.log("(someone tried to swipe without being in a room)");
			return;
		} else if (rooms[id].status != status.SWIPING) {
			socket.emit('user_err', 'Cannot swipe at this time');
			console.log("(someone tried to swipe when the room wasn't ready");
			return;
		}
		console.log("user voted " + swipe + " for " + rooms[id].results.results[locI].name);
		socket.emit('swipe_ack', locI);
		io.to(id).emit('vote_update', swipe, locI);
	});
});

//open port
http.listen(3000, () => {
	console.log('listening on *:3000');
});

//leaves socket.mainRoom, used both when a user clicks "leave" and when they disconnect
function leaveRoom(socket) {
	let id = socket.mainRoom;
	if (id == null) {
		socket.emit('user_err', 'No room to leave');
		console.log("(someone tried to leave without being in a room)");
		return;
	}
	socket.leave(id);
	socket.mainRoom = null;
	rooms[id].people--;
	if (rooms[id].people <= 0) { //("<" shouldn't be necessary, but just in case)
		//no one left, get rid of the empty room
		delete rooms[id];
		console.log("deleting room " + id);
	} else {
		//room not empty, notify people of person leaving
		socket.to(id).emit('other_left', rooms[id].people);
		console.log("user left room " + id);
	}
	socket.emit('leave_ack');
	//console.log(rooms);
}

//get results
function getResults(id, socket, type, lat, lon, radius) {

	if (true) { //TODO: these are dummy results, change to "false" or delete before sending to production
		rooms[id].results = makeDummyCall();
		rooms[id].status = status.READY;
		io.to(id).emit('results', rooms[id].results);
		return;
	}



	//create our api call
	var reqURL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" + lat + "," + lon + "&radius=" + radius + "&type=restaurant&key=" + apiKey;
	fetch(reqURL)
		.then(res => res.json())
		.then(json => {
			//api call return json, then cleans it
			let ret = clean(json);

			//io.to(id).emit('results', ret);//send creator the results
			rooms[id].results = ret;//remember it on the server

			//parse through our results to get all the photos
			let i = 0;
			while (rooms[id].results.results[i]) {
				getPhoto(id, i);
				i++;
			}

		});
}

//Gets the photo urls for every photo by following the api redirect
function getPhoto(id, index) {
	//creates our api call url
	let getUrl = 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + rooms[id].results.results[index].photoRaw + '&key=' + apiKey;

	//requests the api call
	let r = request.get(getUrl, function (err, res, body) {
		//callback function -- update results once we have them
		rooms[id].results.results[index].photo = r.uri.href;

		//console.log(rooms[id].results.results[index].photo);

		//checks to see if all photos have loaded: if they have, then we send the results
		if (checkPhotos(rooms[id].results)) {
			rooms[id].status = status.READY;
			io.to(id).emit('results', rooms[id].results);//send creator the results (and whoever else might've joined reeeeally fast)
			//console.log(rooms[id].results);
		}
	});
}

//checks to see if all of the photos have loaded in
function checkPhotos(ret) {
	let i = 0; //parse through all values from the photos
	while (ret.results[i]) {
		if (ret.results[i].photo == null) return false; //return false if not all have been updated
		i++;
	}
	//return true if we get through the array without finding a missing photo
	return true;
}

//Clean the api results to just what we need
function clean(places) {
	//create our return
	var ret = { results: [] };

	//begin parsing our results
	let i = 0;
	while (places.results[i]) {
		//get our current result values
		let cur = places.results[i];
		//Our temp to push to our ret array
		let temp = {
			lat: cur.geometry.location.lat, //latitude
			lng: cur.geometry.location.lng, //longitude
			name: cur.name, //place name
			photoRaw: cur.photos[0].photo_reference, //the raw photo reference for the api call
			photo: null, //retrieve this later
			price_level: cur.price_level, //price Level
			rating: cur.rating, //User ratings
			user_ratings_total: cur.user_ratings_total //how many ratings
		};

		//Push cleaned values to returned array
		ret.results.push(temp);
		i++; //increment to the next value
	}

	//return our cleaned array
	return ret;
}

//for now, just return this object from Myles' API call
function makeDummyCall() {
	console.log("dummyCall");
	let ret = {
		results: [
			{
				lat: 0,
				lng: 0,
				name: 'HEADS UP - DUMMY CALL',
				photoRaw: 'CmRaAAAANHU8QT4uJ9ax7JEvO-nGA4eHRSlZPod7n67xF4BVEG-p83W-l2BNwwgCsfSU0ayXNy_QL8Pux_atclk_SvSUCBTk5UunNADp5p61pCsLjPEWtHh1Jf_kJo3F-HfqwspNEhCiosWlLzbT19Y2Ua2cWweNGhRHWrTSN0Nl81m9t8c80jn83Ye4Ew',
				photo: 'https://autostart.24sata.hr/media/dg/26/0e/3831ec56637fa92ab7e2.png',
				price_level: 1,
				rating: 5,
				user_ratings_total: 1
			},
			{
				lat: 44.45531030000001,
				lng: -93.164917,
				name: 'Subway',
				photoRaw: 'CmRaAAAANHU8QT4uJ9ax7JEvO-nGA4eHRSlZPod7n67xF4BVEG-p83W-l2BNwwgCsfSU0ayXNy_QL8Pux_atclk_SvSUCBTk5UunNADp5p61pCsLjPEWtHh1Jf_kJo3F-HfqwspNEhCiosWlLzbT19Y2Ua2cWweNGhRHWrTSN0Nl81m9t8c80jn83Ye4Ew',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipNxEiNqQkPLpjTWWnN4Ai0DwNTtS4Uo8OCD6gtb=s1600-w400',
				price_level: 1,
				rating: 3.5,
				user_ratings_total: 126
			},
			{
				lat: 44.457776,
				lng: -93.15952399999999,
				name: 'Chapati',
				photoRaw: 'CmRaAAAALJeKWNIQdpXWMzCGKyXvlnuVtyHVmk8XHi3cyT4RQ4HH1h--7eSQ77U_8HbII8w3UVA4cUXoo_g3qQzFfBtqnvlr9lr4z0oCHUMsqc1TGwZGbtYxnM_BmjDOCDkdrqdkEhBVVT71rnLGl0KqcsF4cU42GhS6KnVD1_CzLzI0qFt0FjAEaEJj4A',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipMFH6LXgWh07Cbc-YPpuaktPBUA5302hug-fatN=s1600-w400',
				price_level: 2,
				rating: 4.4,
				user_ratings_total: 195
			},
			{
				lat: 44.4381399,
				lng: -93.1827122,
				name: "Papa Murphy's Take 'N' Bake Pizza",
				photoRaw: 'CmRaAAAAZYgSG-VHhGl0VTCy_SzzUJcDBeKHEqdS5PDQTI6DwZmF2Wt1cSrxGRZhKfw7Vmip3vM-oUFmWxqalyocenWNllWjJEUpigM46EbfdUobzGdkg7aHy31YbLtbUYzZfoT0EhDmrpTvhSxQVMjEozZ3yHf-GhSRINpbXgG6WR_XEPLDbM-avgLyBQ',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipPuVBQdh3FjJEBPzV3omvN3veZRMPH-W6DkqN90=s1600-w400',
				price_level: 1,
				rating: 3.7,
				user_ratings_total: 70
			},
			{
				lat: 44.4569954,
				lng: -93.1614555,
				name: 'Froggy Bottoms River Pub & Lily PADio',
				photoRaw: 'CmRaAAAA0LQ49HDZXUMoM2GzhjrdwlEqDLTTlNm3CoC_vQhMMUhVKwT-ZIzyw9v1vHtN6Ici8t1thN6fVw0FaDPx9z25xpZAZZCPvBCCYFpGt4quDsPG7RPz8RBS1xKqbJ1N8flSEhBMFoF0tmMeNSzmwdQ2pmYlGhRiZCTyHWk1ssbxTKh_2BnxqQl_hA',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipPDP4MuKzvBY-1c3LRLKEMRM4A8uNCqme0USEtg=s1600-w400',
				price_level: 1,
				rating: 4.4,
				user_ratings_total: 455
			},
			{
				lat: 44.44533500000001,
				lng: -93.176312,
				name: 'Tokyo Grill',
				photoRaw: 'CmRaAAAA63Ut7wD-jYe1PqEfXq_eSa0rLC-OR-Bha7ynNjQ-__FH6JASRfNvpYpk6Ii4WtsAL9JFwV0tHhC0LBHPwx7O4ZNmEHTBCOzvEcEQY5CxArV-Z103vmLfZL1b-1RWBOsXEhC0aiaq7kBKXY9Jj5MvCm4ZGhT2MGtU17vdXZj2To8nRllDFPk8fg',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipOEQtXJ69QBTXmJfFrcUA-7Zcw5u5_IPKhcFLRV=s1600-w400',
				price_level: 2,
				rating: 4.6,
				user_ratings_total: 492
			},
			{
				lat: 44.4560941,
				lng: -93.1595282,
				name: "Domino's Pizza",
				photoRaw: 'CmRaAAAAi9E97DpSLJEJaJYIrbNMJELTpTYGZF_cfDujPSyVQZ_PnsXiZtOacmVe1yjqVwCuJ2FbKfxxoW0Pmf1pT-0k1J9Lmm2mVfvoQRZpPrdgVYDIrIna0XMtNJoFP1lMvYZVEhBdETeAbR0_Ioxg9njipifVGhSFDjPEZNLW_lr2cw18G9LCaiZyfA',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipN4mZE2zNgNGg1tvbK_zi2bH9L5TLO431x-1Ot3=s1600-w400',
				price_level: 1,
				rating: 4.1,
				user_ratings_total: 119
			},
			{
				lat: 44.455499,
				lng: -93.15990699999999,
				name: 'The HideAway Coffeehouse and Wine Bar',
				photoRaw: 'CmRaAAAAz1OhufCTMMcYO4Ne88RPJM6yeTS3VIY6bwVTzJjouqSlCuWaHMgu0TBMluB4xNEnRkhdnvRGhdeV25DhswaepCiwy9mRSdXHTbWLQYTQWztXz8hjq_DTsgYMkWZuVYxWEhDJh2EQiX9HS2A80yGy4xCLGhRqWuzvmZ60tJHD1jlVdy1HatZDWw',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipN8mzbf7GsYJeQslKKCxaWW8Ys20JlkYn7TUxHW=s1600-w400',
				price_level: 2,
				rating: 4.6,
				user_ratings_total: 228
			},
			{
				lat: 44.4603668,
				lng: -93.175338,
				name: 'Ole Store Restaurant',
				photoRaw: 'CmRaAAAAsi-A7sr_cE9tp3-QLF_VQM2x9owf3be2k8IB7aIMP0OGqNeN9epRn9iiuREgFiE-NZwWlLcSUQVDM0QRVxB7nB0ru3Guib8d4KZ_gW0x-rbtZkkCv7Qb3_ZN5-6TN6MqEhD47ENynH9p5KVKNXuWuD1OGhRams-IveTKivTgEMZXiDGOBez80Q',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipPVkiyGbZ86St85nmQpx5Zvs4ExjPVoAAPOYEXq=s1600-w400',
				price_level: 2,
				rating: 4.5,
				user_ratings_total: 465
			},
			{
				lat: 44.4543554,
				lng: -93.1603627,
				name: 'VFW Post 4393 (Veterans of Foreign Wars)',
				photoRaw: 'CmRaAAAAofHER3Xzz7dsWfI7T67pW5huKLzEQm8AyZ09btNm60_bAmBEqiMccCOS9edbo2HoxbGk-FYnj01xi0XfLL918GqniFXONZ4eKQfcyt_VFwqUlqnJ09sWMR0QwCnIcTtuEhDOHTEW3NOrJ7pJ3q9xJUnKGhR2vDEGfPXktLmUzNLJJ9qlhLzE5Q',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipPDBrn3_v8LbnlGaw1GONEvBlCuHh86kbozmKgB=s1600-w400',
				price_level: undefined,
				rating: 4.5,
				user_ratings_total: 77
			},
			{
				lat: 44.4539227,
				lng: -93.1623285,
				name: "Carbone's Pizzeria",
				photoRaw: 'CmRaAAAA5ldcSnXXm8EkHApcEV7Sk3p0UOJbY9m_j4kQifV0WbDVzVsb8J8Hr7A0_RVALkxyyOu_FyUy6l30Uw-ZrhQMGki--D1kH5cV7xACWJiIF0Hs12X3lVTwYEMlOfKx1kvHEhD5y9svo-r_m3owCi0bX65oGhTTsm91g2X24Pl5G1G0VXikLLqiLw',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipOomD7M1uOsbOH6oYlMBOZgOwyEA1uZBGCS8_Hr=s1600-w400',
				price_level: undefined,
				rating: 4,
				user_ratings_total: 213
			},
			{
				lat: 44.4618757,
				lng: -93.1827923,
				name: "The Lion's Pause",
				photoRaw: 'CmRaAAAAUJhk7Yj2XgcBqc1XHe09taGj3M9z26mVWSWsc_YIFaXaVgNkWW1_ppq7KkpVb7dQYDpfSLDhy6eNUptxKZvI4OrMFxlQVdF47y1nTLbA6QxZAI71FcaThWcr2Iq0QNX_EhC8o39xUPPGGJE8efWQnGYJGhQ5rvaJJ4Q-bJxmruIDMR7aST1-uQ',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipPJNokeVH2bPmePgYK66ls9qAPdyYt_G8_oFO3I=s1600-w400',
				price_level: 1,
				rating: 4.4,
				user_ratings_total: 30
			},
			{
				lat: 44.4377785,
				lng: -93.1832733,
				name: 'Gran Plaza Northfield',
				photoRaw: 'CmRaAAAAxshNrXo5SQlWKddpliHurTqtE5L_WmAc3gQuPVMGnFIAIw6bNXQTD9v1K2b9ZK6VZh2T46p0405DKMe4GIbO-FZMd24uL9VCQdSXSwdc6w3rBLigih5QD50rAiAzHVVZEhDWzenP73klUqitpQq6nGeEGhS8tp_K9HscTKB2FSLgpcF_Av_pjQ',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipPDEtBZsU59y69-v5cZ-zPKtCGIPUmPcmobpNrQ=s1600-w400',
				price_level: 2,
				rating: 4.5,
				user_ratings_total: 260
			},
			{
				lat: 44.4349767,
				lng: -93.1888659,
				name: 'Fielders Choice Tap & Table',
				photoRaw: 'CmRaAAAAHggtEZolkmdN4bQeovgFs7j45kDqn489cIx9TH1gff0nS89YqJyWEg27b6G46rTaU-ICMuwWJ737y_CIM0yN2HPfgfoG7u6di9nqYn_AMz55xFM-khwJJ-tk17aIOErzEhAiPMzNEW1W4jb4GUVDILIGGhRSFVZ1-wR2C6DvLBUpZasuBjNn9w',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipOIMwYR-HGoZ4dmFfUaWAa409H3cNE8XmNquo4Y=s1600-w400',
				price_level: 2,
				rating: 4.3,
				user_ratings_total: 518
			},
			{
				lat: 44.4323001,
				lng: -93.1892967,
				name: "Applebee's Grill + Bar",
				photoRaw: 'CmRaAAAA9lmFBgQh9Lg3cHwUTd7Og68Qh2yxwXOf5Y7zkP2mghzS30mC-B_gLi8yD33XGZFD74xu7UTOSWMQAezk6CgxEWoZUlMY6Wlf0lAXjMK5hhRn7ILmLoeTKzLX2FJ-q9q6EhBPGko_mZCY7Hnz0mBmUggJGhQSCFrXBOvjOPPTHJQ7ahfNrEnnOQ',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipP4AK9q89OwY_aOspXi3YqksVeepROYTDKB5Byh=s1600-w400',
				price_level: 2,
				rating: 3.9,
				user_ratings_total: 445
			},
			{
				lat: 44.4563736,
				lng: -93.1594659,
				name: 'Mandarin Garden Restaurant',
				photoRaw: 'CmRaAAAA0G-Y1cbrLv7LJY3JDdLRcHTmLdvQW-iotj8ITAUF5h5-VMyW56OLs2H_fraJdHw9gwnTYTltRrXq_6OIIyufJ9ZGsxZmvz74NJ_stkVzmXG5vvJPlxUkd3xeSV1z6iQ1EhA_vCoV3G4VjgozA2qyAz1NGhSPape1MzADWVOjAblhxEVOHuphKQ',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipMAmFyo8mlBnzH8U8L9bQORLykUCO-IbNLtzmVm=s1600-w400',
				price_level: 2,
				rating: 4,
				user_ratings_total: 81
			},
			{
				lat: 44.4305403,
				lng: -93.2070545,
				name: 'L & M Bar & Grill & Patio',
				photoRaw: 'CmRaAAAAGaEFLv-JAXyXe1lD28NTWp-sEwgTE5sYFcBG0FRF1-Tz5wvUacHR0v68Ik5qkfQ16CoKrIpXlIYPH8vn0sNm8O4BDqg-UAC3_e_JJkQwOxfjfgH13AeNNlUUwKgxnh0MEhDEh_y-Jpa57y8SelRaNAyZGhSnA9xZnAtpSVkoTWGP1e3qXGbh6Q',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipPVG4RfGXn7toDgIHFNGV1QWu8-3eNjhF7Bwksa=s1600-w400',
				price_level: 1,
				rating: 4.6,
				user_ratings_total: 240
			},
			{
				lat: 44.449216,
				lng: -93.1717886,
				name: 'El Tequila Mexican Restaurant',
				photoRaw: 'CmRaAAAASZjf051AFwpGqC3sGQMPH4DXLm2JXVoM9EtZQHATaQIO5ZDoe4H1eHE8DdGMaJCOoXlAI4SuqbSTowZyxUAKZUh2Kk13QTIhWcxsYva5RDUVJmTsFNU7swgXlJSDBweGEhBcIE7K9ylTtow_4YDelNXcGhRwhkUj2JDTZ4NNfJg633uX45IKgw',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipN2eM8xFWgYsNTqiqojI_JjHmKeswJPkRcBwsdh=s1600-w400',
				price_level: 2,
				rating: 4.4,
				user_ratings_total: 289
			},
			{
				lat: 44.44769899999999,
				lng: -93.173476,
				name: "George's Vineyard",
				photoRaw: 'CmRaAAAAmoJ3_Ltzw0ly1NSS1Qs49Y7Ahd3cAXThWDPEaREfHnsGaOOHfosm7UND7Gq1FkP4xxs2xmGX7uPRSwGXkcCa6BHIrUCXriwG_aU3CebItf5gwoFvDW2KVLEuDIbJ2bd8EhB_ayw7tb2BrOonx_w4yYM5GhRzaKaF4z1va3zcewyqmrPwss4eOg',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipPtI3ISPouKk6pFld1nzEnnXGHC6vlVed2zVh-p=s1600-w400',
				price_level: 2,
				rating: 4.5,
				user_ratings_total: 359
			},
			{
				lat: 44.455642,
				lng: -93.16002999999999,
				name: 'Hogan Brothers',
				photoRaw: 'CmRaAAAANP9F3w7NHG7EQPYaBu1IaoDW2tY5_ykywLMYAIqiWwB483_89dlROPwGRU2Xhfy6GQp5PvWUyjn5hX7hiz37eFalDOyQmoW8ephvTjNBumjQsRgtf9OGihPU8LswHQ2EEhBKIUQBp3KXY7MIH2E7LPxwGhSCKyGpzopJMfU_hOkm4l6rZNYOpA',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipMJ3eMixorAmhSYg-tmCSufNCV1ZPlEaAQRKC6T=s1600-w400',
				price_level: 1,
				rating: 4.6,
				user_ratings_total: 700
			},
			{
				lat: 44.4502163,
				lng: -93.1709061,
				name: "Culver's",
				photoRaw: 'CmRaAAAA-ZJ1Du4ij3W7BP-jft34BkRoxnhwmgmc_RgRA1RLrsrFYUuYSYNhzt2duIVtqfmPKvUm6TilLNbIIWPPJM8_ILfEbNaehM9QVzjau_xnNtc_Zr4bieZuUfN3c2ei_lwlEhDNMXriwZJvCyErKKgv-TIQGhTahbPYjUVHu2Ldg6xkkqYdFRitTw',
				photo: 'https://lh3.googleusercontent.com/p/AF1QipM-eq400CYpcLM4s3KnUMKVQZCT6rK9PPqF7Ld4=s1600-w400',
				price_level: 1,
				rating: 4.4,
				user_ratings_total: 673
			}
		]
	}
	return ret;
}
