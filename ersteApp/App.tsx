import { setStatusBarBackgroundColor, StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Züge sind toll https://www.google.com/imgres?q=never%20forgetti&imgurl=https%3A%2F%2Fi.redd.it%2Fupdi3oibla9d1.jpeg&imgrefurl=https%3A%2F%2Fwww.reddit.com%2Fr%2FMemeRestoration%2Fcomments%2F1dpqa0t%2Fdoes_anyone_have_a_higher_version_of_never%2F%3Ftl%3Dde&docid=uhzG0UmuYVNVMM&tbnid=bAWWseNOx9TfLM&vet=12ahUKEwjN_qyJ17eQAxVDxQIHHcOsBO0QM3oECBkQAA..i&w=692&h=798&hcb=2&ved=2ahUKEwjN_qyJ17eQAxVDxQIHHcOsBO0QM3oECBkQAA 
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  backgroundColor: "#FFD700"
  },
  text:{
    fontSize: 20,
    color:"#333",
  }
});