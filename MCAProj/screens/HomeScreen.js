import React from 'react'
import { SafeAreaView, StyleSheet, Text } from 'react-native'
import Swiper from 'react-native-deck-swiper'
import { Card } from '../components/Card'
import { HomeScreenPics } from '../constants/Restaurants'
import Entypo from 'react-native-vector-icons/Entypo';


class HomeScreen extends React.Component {
  constructor(props) {
    super(props);
    const result = props.result;
    const socket = props.socket;
    var index = props.index;
    //example results console.log();
    //onsole.log(result);
  }


  render() {
    return (
      <SafeAreaView style={styles.container}>
        <Swiper
          cards={this.props.result.results}
          renderCard={Card}
          infinite
          backgroundColor="white"
          cardHorizontalMargin={0}
          stackSize={3}
          animateCardOpacity
          animateOverlayLabelsOpacity
          showSecondCard
          overlayLabels= {{
            left: {
            element: <Entypo name="thumbs-down" color= 'red' size={65} />,
            title: 'DISLIKE',
              style: {
                label: {
                  backgroundColor:'red',
                  borderColor: 'red',
                  color: 'red',
                  borderWidth: 1,
                  fontsize: 14,
                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: -30
                }
              }
            },
            right: {
            element: <Entypo name="thumbs-up" color='green' size={65} />,
            title: 'LIKE',
              style: {
                label: {
                  backgroundColor: 'green',
                  borderColor: 'green',
                  color: 'white',
                  borderWidth: 1,
                  fontsize: 14,

                },
                wrapper: {
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  marginTop: 30,
                  marginLeft: 30
                }
              }
            }
          }}
          OverlayLabelStyle= {{
            fontSize: 45,
            fontWeight: 'bold',
            borderRadius: 10,
            padding: 10,
            overflow: 'hidden',
            color: 'green'
          }}
          useViewOverflow={Platform.OS === 'ios'}
        />
      </SafeAreaView>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
})

export default HomeScreen
