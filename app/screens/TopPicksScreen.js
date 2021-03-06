import React from 'react'
import { ScrollView, RefreshControl, StyleSheet, View } from 'react-native'
import { Text, Tile } from 'react-native-elements'
import { SafeAreaView } from 'react-navigation'
import openMap from 'react-native-open-maps';

//TODO: crashes when user has swiped through all restaurants

class TopPicksScreen extends React.Component {
  constructor(props) {
    super(props);
    const results = props.results;
    var index = props.index;

    this.results = results;

    this.state = {
      top_results: [],
      refreshing: false
    };

    this.onRefresh = this.onRefresh.bind(this)
  }

  componentDidMount() {
    global.socket.on('top_results', (top_results) => {
      this.setState({ top_results });
      console.log("Logging top picks");
      console.log(this.state.top_results);
      this.setState({refreshing: false});
    });

    global.socket.emit('request_top_results');
  }

  componentWillUnmount() {
    global.socket.off('top_results');
  }


  tileOnPress(address) {
    openMap({ end: address });
  }

  onRefresh() {
    this.setState({refreshing: true});
    global.socket.emit('request_top_results');
  }

  render() {
    var tiles = [];
    let i = 0;
    while(this.state.top_results[i]){
      let id=this.state.top_results[i][0];
      let currResult=null;
      //there's probably a better way of going about this, but this'll do for finding which location card has that ID
      for(let j=0;j<this.results.length;j++){
        if(this.results[j].id==id){
          currResult=this.results[j];
          break;
        }
      }

      let lat = currResult.lat;
      let lng = currResult.lng;
      let address = currResult.address;
      tiles.push(
        <Tile
        imageSrc={{uri:currResult.photo}}
        activeOpacity={0.9}
        title={currResult.name}
        titleStyle={styles.title}
        caption={currResult.price_level}
        captionStyle={styles.caption}
        featured
        onPress = {() => this.tileOnPress(address)}
      />
      )
      i++;

    }

    return (
      <SafeAreaView>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing = {this.state.refreshing} onRefresh={this.onRefresh} />
          }
        >
          <Text h2 h2Style={styles.h2Style}>
            Top Picks
          </Text>
          <Text h4 h4Style={styles.h4Style}>
            The restaurants you and your friends like the most
          </Text>
          <View style={styles.grid}>

            {tiles}

          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }
}

const styles = StyleSheet.create({
  h2Style: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#e18a7a',
  },
  h4Style: {
    textAlign: 'center',
    color: '#a78d8a',
  },
  grid: {
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    position: 'absolute',
    left: 10,
    bottom: 50,
    backgroundColor: 'black',
    marginBottom: -2,
    padding: 10,
  },
  caption: {
    position: 'absolute',
    left: 10,
    bottom: 0,
    backgroundColor: 'black',
    marginTop: 10,
    padding: 10,
  },
})

export default TopPicksScreen