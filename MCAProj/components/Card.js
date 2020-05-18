
import React from 'react'
import { Platform, StyleSheet, Image, View, Dimensions } from 'react-native'
import { Tile } from 'react-native-elements'
import Layout from '../constants/Layout'
//import {Image, Tile} from '@shoutem/ui'

const BOTTOM_BAR_HEIGHT = !Platform.isPad ? 29 : 49 // found from https://stackoverflow.com/a/50318831/6141587

/*
<View>
  <Image
    style={{
      flex: 1,
      height: null,
      width: null,
      resizeMode: "cover",
      borderRadius: 35,
      justifyContent: 'center'
    }}
    source={{uri: photo}}
  />
</View>


<Image
  style={{
    flex: 1,
    height: null,
    width: Layout.window.width - 30,
    resizeMode: "cover",
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center'
  }}
  source={{uri: photo}}
/>
*/

export const Card = ({ photo, name, price_level }) => (
  <Tile
    imageSrc={{uri:photo}}
    imageContainerStyle={styles.imageContainer}
    activeOpacity={0.9}
    title={name}
    titleStyle={styles.title}
    caption={price_level}
    captionStyle={styles.caption}
    containerStyle={styles.container}
    featured
  />
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  imageContainer: {
    width: Layout.window.width - 30,
    height: Layout.window.height - BOTTOM_BAR_HEIGHT * 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  title: {
    position: 'absolute',
    left: 10,
    bottom: 30,
  },
  caption: {
    position: 'absolute',
    left: 10,
    bottom: 10,
  },
})