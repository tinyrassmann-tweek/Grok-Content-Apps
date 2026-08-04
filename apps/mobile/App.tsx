import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  TextInput,
  Text,
  View,
  StyleSheet,
} from "react-native";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import * as SecureStore from "expo-secure-store";

const ARTIFACT_ID = "demo-artifact";

export default function App() {
  const [body, setBody] = useState("");
  const docRef = useRef<Y.Doc>();

  useEffect(() => {
    let ws: WebsocketProvider | undefined;
    let doc: Y.Doc | undefined;

    (async () => {
      const token =
        (await SecureStore.getItemAsync("biab_token")) || "anonymous";
      doc = new Y.Doc();
      docRef.current = doc;
      const wsUrl =
        process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:4000/collab";
      ws = new WebsocketProvider(wsUrl, ARTIFACT_ID, doc, {
        params: { token },
      });
      const yText = doc.getText("body");
      const update = () => setBody(yText.toString());
      yText.observe(update);
      update();
      ws.awareness.setLocalStateField("user", {
        name: "Mobile",
        color: "#D4AF37",
      });
    })();

    return () => {
      ws?.destroy();
      doc?.destroy();
    };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Think Tank · B.i.a.B</Text>
      </View>
      <TextInput
        style={styles.input}
        multiline
        value={body}
        onChangeText={(t) => {
          const yText = docRef.current?.getText("body");
          if (!yText || !docRef.current) return;
          docRef.current.transact(() => {
            yText.delete(0, yText.length);
            yText.insert(0, t);
          });
        }}
        placeholder="Start collaborating…"
        placeholderTextColor="#8A8D91"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAF9F7" },
  header: {
    padding: 16,
    borderBottomColor: "#D6D3CC",
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0A2540" },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: "#36454F",
    textAlignVertical: "top",
  },
});
