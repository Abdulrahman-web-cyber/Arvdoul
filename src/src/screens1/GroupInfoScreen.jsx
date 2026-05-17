// src/screens/GroupInfoScreen.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import messagingService from '../services/messagesService';
import { Ionicons } from '@expo/vector-icons';

export default function GroupInfoScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = async () => {
    try {
      const result = await messagingService.getConversation(conversationId);
      if (result.success) {
        setConversation(result.conversation);
        setParticipants(result.conversation.participantDetails || []);
        setIsAdmin(result.conversation.admins?.includes(user.uid));
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load group info');
    }
  };

  const removeParticipant = async (userId) => {
    Alert.alert('Remove', 'Remove this participant?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await messagingService.removeParticipants(conversationId, [userId], user.uid);
            loadInfo();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const makeAdmin = async (userId) => {
    try {
      await messagingService.setUserRole(conversationId, userId, 'admin', user.uid);
      loadInfo();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderParticipant = ({ item }) => (
    <View className="flex-row items-center py-3 border-b border-gray-200 dark:border-gray-800">
      <Image source={{ uri: item.photoURL }} className="w-12 h-12 rounded-full" />
      <View className="ml-3 flex-1">
        <Text className="font-semibold text-gray-900 dark:text-white">{item.displayName}</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">@{item.username}</Text>
      </View>
      {isAdmin && item.uid !== user.uid && (
        <View className="flex-row">
          <TouchableOpacity onPress={() => makeAdmin(item.uid)} className="mr-3">
            <Ionicons name="shield-outline" size={22} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeParticipant(item.uid)}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}
      {item.uid === user.uid && <Text className="text-xs text-gray-500">You</Text>}
      {conversation?.admins?.includes(item.uid) && (
        <View className="ml-2 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-full">
          <Text className="text-xs text-blue-800 dark:text-blue-200">Admin</Text>
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <View className="pt-12 pb-2 px-4 flex-row items-center bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">Group Info</Text>
      </View>

      <FlatList
        data={participants}
        keyExtractor={(item) => item.uid}
        renderItem={renderParticipant}
        ListHeaderComponent={
          <>
            <View className="items-center py-4">
              <Image source={{ uri: conversation?.photoURL }} className="w-20 h-20 rounded-full" />
              <Text className="text-lg font-semibold mt-2 text-gray-900 dark:text-white">{conversation?.name}</Text>
              <Text className="text-sm text-gray-500">{conversation?.participantCount} participants</Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AddParticipants', { conversationId })}
                className="bg-blue-600 py-3 mx-4 rounded-full mb-4"
              >
                <Text className="text-white text-center font-semibold">Add Participants</Text>
              </TouchableOpacity>
            )}
          </>
        }
      />
    </View>
  );
}