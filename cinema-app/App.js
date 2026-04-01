import { Video } from 'expo-av';
import { Send, Users } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function MovieScreen() {
  const [status, setStatus] = useState({});

  return (
    <View style={styles.container}>
      {/* Видео плеер */}
      <Video
        source={{ uri: 'https://vjs.zencdn.net/v/oceans.mp4' }} // Тестовое видео
        rate={1.0}
        volume={1.0}
        isMuted={false}
        resizeMode="contain"
        shouldPlay={false}
        useNativeControls
        style={styles.video}
        onPlaybackStatusUpdate={status => setStatus(() => status)}
      />

      {/* Чат и заметки */}
      <View style={styles.chatContainer}>
        <View style={styles.header}>
          <Users color="white" size={20} />
          <Text style={styles.headerText}> Совместный просмотр: Океаны</Text>
        </View>
        
        <ScrollView style={styles.messages}>
          <Text style={styles.msg}>Я: Смотри какой кит!</Text>
          <Text style={styles.msgFriend}>Друг: Ого, реально огромный.</Text>
        </ScrollView>

        <View style={styles.inputArea}>
          <TextInput 
            style={styles.input} 
            placeholder="Написать в чат..." 
            placeholderTextColor="#666"
          />
          <TouchableOpacity style={styles.sendBtn}>
            <Send color="white" size={20} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 40 },
  video: { width: '100%', height: 250, backgroundColor: '#000' },
  chatContainer: { flex: 1, padding: 15 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  messages: { flex: 1 },
  msg: { color: '#bbb', marginBottom: 10, alignSelf: 'flex-end', backgroundColor: '#333', padding: 8, borderRadius: 10 },
  msgFriend: { color: '#bbb', marginBottom: 10, alignSelf: 'flex-start', backgroundColor: '#1E1E1E', padding: 8, borderRadius: 10 },
  inputArea: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10 },
  input: { flex: 1, color: 'white', backgroundColor: '#1E1E1E', borderRadius: 20, paddingHorizontal: 15, height: 40 },
  sendBtn: { marginLeft: 10, backgroundColor: '#6200EE', padding: 10, borderRadius: 20 }
});