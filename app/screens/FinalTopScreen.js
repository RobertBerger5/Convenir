import React from 'react';
import { StyleSheet, TouchableOpacity, Button, Text, View, Dimensions, Image, Animated, PanResponder } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { RFPercentage, RFValue } from "react-native-responsive-fontsize";
import { Dropdown } from 'react-native-material-dropdown';
import io from "socket.io-client";
import socketIO from 'socket.io-client';
import Icon from 'react-native-vector-icons/Entypo';
import Modal from 'react-native-modal';
import CheckBox from 'react-native-check-box';
import TopPicksScreen from './TopPicksScreen';

class FinalTopScreen extends React.Component {
  constructor(props) {
    super(props);
    const {results } = this.props.route.params;
    this.results = results;
  }

  render () {
    return (
      <View style={{flex: 1}}>
        <View style={{alignItems: 'flex-start'}}>
          <Button title="Back" onPress={() => {global.socket.emit('leave'); global.index = 0; this.props.navigation.popToTop()}} color='#e18a7a' />
        </View>
        <TopPicksScreen results = {this.results} index = {global.index}/>
      </View>
    )
  }
}

export default FinalTopScreen;