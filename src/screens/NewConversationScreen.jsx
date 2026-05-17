// src/screens/NewConversationScreen.jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import messagingService from '../services/messagesService';
import { Ionicons } from '@expo/vector-icons';

export default function NewConversationScreen({ navigation }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const friendsList = await userService.getFriends?.(user.uid) || [];
      setFriends(friendsList);
    } catch (err) {
      console.warn('Failed to load friends', err);
    }
  };

  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await userService.searchUsers(text, { limit: 10 });
      setResults(res.users || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  };

  const startConversation = async (otherUserId) => {
    try {
      const result = await messagingService.createConversation([otherUserId]);
      if (result.success) {
        navigation.replace('Chat', { conversationId: result.conversation.id });
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity
      onPress={() => startConversation(item.uid || item.id)}
      className="flex-row items-center p-3 border-b border-gray-200 dark:border-gray-800"
    >
      <Image source={{ uri: item.photoURL }} className="w-12 h-12 rounded-full" />
      <View className="ml-3 flex-1">
        <Text className="font-semibold text-gray-900 dark:text-white">{item.displayName}</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">@{item.username}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-white dark:bg-gray-950">
      <View className="pt-12 pb-2 px-4 flex-row items-center bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900 dark:text-white">New Message</Text>
      </View>

      <View className="p-4">
        <TextInput
          className="bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-3 text-base text-gray-900 dark:text-white"
          placeholder="Search people"
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={handleSearch}
          autoFocus
        />
      </View>

      {loading && <ActivityIndicator size="large" color="#3B82F6" className="mt-4" />}

      {searchQuery.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid || item.id}
          renderItem={renderUser}
          ListEmptyComponent={!loading && <Text className="text-center text-gray-500 mt-4">No users found</Text>}
        />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid || item.id}
          renderItem={renderUser}
          ListHeaderComponent={<Text className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300">Friends</Text>}
          ListEmptyComponent={<Text className="text-center text-gray-500 mt-4">No friends yet</Text>}
        />
      )}
    </View>
  );
}