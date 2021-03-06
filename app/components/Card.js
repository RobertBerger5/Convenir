
import React from 'react'
import { Platform, StyleSheet, View, Dimensions, Text } from 'react-native'
import Layout from '../constants/Layout'
import Image from 'react-native-image-progress';
import ProgressBar from 'react-native-progress/Bar';
import { images, renderReview } from './assets/stars.js';

const BOTTOM_BAR_HEIGHT = !Platform.isPad ? 29 : 49 // found from https://stackoverflow.com/a/50318831/6141587

const Card = ({ card }) => (
  <View
    activeOpacity={1}
    style={styles.card}
  >
    <Image
      style={styles.image}
      imageStyle={{borderRadius:15}}
      source={{uri: card.photo}}
      indicator={ProgressBar}
      indicatorProps={{
        width: 150,
        height: 12,
        color: '	#808080',
        borderColor:'	#808080',
      }}
    />
    <View style={styles.photoDescriptionContainer}>
      {/*TODO: some restaurant names could run off the card, disable overflow-x?*/}
      
      <Text style={styles.text}>{card.name}</Text>
      <Text style={styles.text}>{card.price_level}</Text>

      <Image source={renderReview(card.rating)} />
      
    </View>
  </View>
)

const styles = StyleSheet.create({
  card: {
    /* Setting the height according to the screen height, it also could be fixed value or based on percentage. In this example, this worked well on Android and iOS. */
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'grey',
    borderRadius: 15,
    shadowColor: 'black',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 6,
    shadowOpacity: 0.3,
    elevation: 2,
  },
  image: {
    flex: 1,
    height: null,
    width: Layout.window.width - 30,
    resizeMode: "cover",
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15
  },
  photoDescriptionContainer: {
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    flexDirection: 'column',
    height: '100%',
    position: 'absolute',
    left: 10,
    bottom: 25,
  },
  text: {
    textAlign: 'center',
    fontSize: 20,
    color: 'white',
    textShadowColor: 'black',
    textShadowRadius: 10,
  },
})

export default Card