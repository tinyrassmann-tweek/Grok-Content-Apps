import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  TextInput,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import * as SecureStore from "expo-secure-store";

const ARTIFACT_ID = "demo-artifact";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const WS_BASE =
  process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:4000/collab";

async function getToken(): Promise<string> {
  const cached = await SecureStore.getItemAsync("biab_token");
  if (cached) return cached;
  const res = await fetch(
    `${API_URL}/auth/dev-token?artifactId=${encodeURIComponent(ARTIFACT_ID)}`
  );
  if (!res.ok) throw new Error(`dev-token HTTP ${res.status}`);
  const data = (await res.json()) as { token: string };
  await SecureStore.setItemAsync("biab_token", data.token);
  return data.token;
}

export default function App() {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("starting");
  const docRef = useRef<Y.Doc>();

  useEffect(() => {
    let ws: WebsocketProvider | undefined;
    let doc: Y.Doc | undefined;
    let cancelled = false;

    (async () => {
      try {
        setStatus("auth");
        const token = await getToken();
        if (cancelled) return;
        doc = new Y.Doc();
        docRef.current = doc;
        setStatus("connecting");
        ws = new WebsocketProvider(WS_BASE, ARTIFACT_ID, doc, {
          params: { token },
        });
        ws.on("status", (e: { status: string }) => {
          setStatus(e.status);
        });
        const yText = doc.getText("body");
        const update = () => setBody(yText.toString());
        yText.observe(update);
        update();
        ws.awareness.setLocalStateField("user", {
          name: "Mobile",
          color: "#D4AF37",
        });
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "error");
      }
    })();

    return () => {
      cancelled = true;
      ws?.destroy();
      doc?.destroy();
    };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Think Tank · B.i.a.B</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
      {status === "auth" || status === "starting" ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#0A2540" />
      ) : (
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAF9F7" },
  header: {
    padding: 16,
    borderBottomColor: "#D6D3CC",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0A2540" },
  status: { fontSize: 11, color: "#8A8D91", textTransform: "uppercase" },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: "#36454F",
    textAlignVertical: "top",
  },
});
