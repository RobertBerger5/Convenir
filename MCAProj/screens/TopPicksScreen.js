import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Text, Tile } from 'react-native-elements'
import { SafeAreaView } from 'react-navigation'
import { TopPicksScreenPics } from '../constants/Restaurants'

class TopPicksScreen extends React.Component {
  constructor(props) {
    super(props);
    const result = props.result;
    const socket = props.socket;
    var index = props.index;

    this.socket = socket;
    this.result = result;

    this.state = {
      top_results: [],
    };
    //example results console.log();
    //onsole.log(result);
  }

  componentDidMount() {
    this.socket.on('top_results', (top_results) => {
      this.setState({ top_results });
      console.log("Logging top picks");
      console.log(this.state.top_results);
    });

    this.socket.emit('request_top_results');
  }

  componentWillUnmount() {
    this.socket.off('top_results');
  }

  render() {
    return (
      <SafeAreaView>
        <ScrollView>
          <Text h2 h2Style={styles.h2Style}>
            Top Picks
          </Text>
          <Text h4 h4Style={styles.h4Style}>
            The restaurants you and your friends like the most
          </Text>
          <View style={styles.grid}>
            {TopPicksScreenPics.map(({ pic, title, caption }, i) => (
              <Tile
                imageSrc={pic}
                activeOpacity={0.9}
                title={title}
                titleStyle={styles.title}
                caption={caption}
                captionStyle={styles.caption}
                featured
                key={title}
              />
            ))}
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
   // color: '#000000',
    color: '#e18a7a',
  },
  h4Style: {
    textAlign: 'center',
    //color: '#757575',
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