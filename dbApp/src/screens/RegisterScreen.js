import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, TouchableOpacity } from "react-native";
import CustomButton from "../component/CustomButton";
import SearchBox from "../component/SearchBox";
import { MaterialIcons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set, get, child } from "firebase/database";

// ฟังก์ชันตรวจสอบว่าชื่อผู้ใช้ (username) ซ้ำหรือไม่
const isUsernameAvailable = async (name) => {
  // ถ้าไม่มีชื่อ หรือเป็นช่องว่าง -> ถือว่าใช้ได้ (ไม่ต้องตรวจ)
  if (!name || name.trim() === "") return true; 

  // แปลงชื่อเป็นตัวพิมพ์เล็ก เพื่อป้องกันปัญหาชื่อซ้ำแบบตัวเล็ก/ใหญ่ต่างกัน
  const searchName = name.toLowerCase();

  try {
    const usersSnapshot = await get(child(ref(db), "users"));
    if (usersSnapshot.exists()) {
      const usersData = usersSnapshot.val();
      // ตรวจว่า username ซ้ำหรือไม่
      const userExists = Object.values(usersData).some(
        (user) => user.username && user.username.toLowerCase() === searchName
      );
      if (userExists) return false; // ถ้าซ้ำ -> ใช้ไม่ได้
    }

    const visitorsSnapshot = await get(child(ref(db), "visitors"));
    if (visitorsSnapshot.exists()) {
      const visitorsData = visitorsSnapshot.val();
      const visitorExists = Object.values(visitorsData).some(
        (visitor) => visitor.visitorUsername && visitor.visitorUsername.toLowerCase() === searchName
      );
      if (visitorExists) return false; // ถ้าซ้ำ -> ใช้ไม่ได้
    }

    // ถ้าไม่ซ้ำทั้งใน users และ visitors
    return true; 

  } catch (error) {
    console.error("Error checking username:", error);
    // โยน Error กลับไปให้ฟังก์ชันที่เรียกใช้ (handleRegister) จัดการต่อ
    throw new Error("Could not verify username. Check database rules or network.");
  }
};


const RegisterScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const handleRegister = async () => {
    try {
      if (!username || !email || !password || !confirmPassword || !licensePlate) {
        Alert.alert("Error", "Please fill in all fields");
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }

      // ตรวจสอบ Username ตอน Submit
      const available = await isUsernameAvailable(username);
      if (!available) {
        setUsernameError("Username taken. Please enter your username again.");
        Alert.alert("Error", "Username taken. Please enter your username again.");
        return;
      }
      setUsernameError(""); 

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;

      // ส่วนนี้ยังคงบันทึกใน Node users เหมือนเดิมตามที่คุณต้องการครับ
      await set(ref(db, "users/" + userId), {  
        username,
        phoneNumber,
        email,
        licensePlate,
        createdAt: new Date().toISOString(),
      });

      Alert.alert("Success", "Registration Successful!");
      navigation.navigate("Login");

    } catch (error) {
      console.error(error);
      // ถ้า Error มาจาก isUsernameAvailable (เช่น Permission Denied) 
      // หรือมาจาก createUser... ก็จะแสดงที่นี่
      Alert.alert("Register Failed", error.message); 
    }
  };

  // ฟังก์ชันสำหรับตรวจสอบขณะพิมพ์ / onBlur
  const validateUsername = async (text) => {
    if (text.trim().length > 0) {
      try {
        const available = await isUsernameAvailable(text);
        if (!available) {
          setUsernameError("Username taken. Please enter your username again.");
        } else {
          setUsernameError("");
        }
      } catch (error) {
        // ถ้าเช็คตอน onBlur แล้ว error (เช่น ไม่มีเน็ต)
        // อาจจะเลือกแจ้งเตือนเบาๆ หรือไม่แจ้งก็ได้
        console.warn("Could not validate username on blur:", error.message);
        setUsernameError("Could not check username."); // หรือปล่อยว่าง
      }
    } else {
      setUsernameError("");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.header}>
        <MaterialIcons name="person-add" size={40} color="white" />
        <Text style={styles.title}>Create Account</Text>
      </View>

      <View style={styles.inputContainer}>
        <SearchBox
          placeHolder="Username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (usernameError) setUsernameError(""); // ลบ Error ทันทีที่เริ่มพิมพ์ใหม่
          }}
          onBlur={() => validateUsername(username)} // ตรวจสอบเมื่อ focus ออก
          icon="person"
          containerStyle={styles.input} 
        />
        {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
      </View>

      <View style={styles.inputContainer}>
        <SearchBox
          placeHolder="Phone Number"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          icon="phone"
          containerStyle={styles.input}
        />
      </View>

      <View style={styles.inputContainer}>
        <SearchBox
          placeHolder="Email"
          value={email}
          onChangeText={setEmail}
          icon="email"
          containerStyle={styles.input}
        />
      </View>

      <View style={styles.inputContainer}>
        <SearchBox
          placeHolder="Password"
          secure={true}
          value={password}
          onChangeText={setPassword}
          icon="lock"
          containerStyle={styles.input}
        />
      </View>

      <View style={styles.inputContainer}>
        <SearchBox
          placeHolder="Confirm Password"
          secure={true}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          icon="lock"
          containerStyle={styles.input}
        />
      </View>

      <View style={styles.inputContainer}>
        <SearchBox
          placeHolder="License Plate"
          value={licensePlate}
          onChangeText={setLicensePlate}
          icon="directions-car"
          containerStyle={styles.input}
        />
      </View>


      <CustomButton
        title="Register"
        backgroundColor="#FFFFFF"
        textColor="#B19CD8"
        fontSize={18}
        width="100%"
        borderRadius={15}
        marginTop={20}
        onPress={handleRegister}
      />

      <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate("Login")}>
        <Text style={styles.loginText}>
          Already have an account? <Text style={styles.loginHighlight}>Log In</Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: '#B19CD8',
    padding: 25,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 15,
  },
  inputContainer: {
    marginBottom: 10,
    width: '100%',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '100%',
  },
  errorText: {
    color: 'red',
    marginTop: 5, 
    marginLeft: 15,
  },
  loginLink: {
    marginTop: 25,
    alignItems: 'center',
  },
  loginText: {
    color: 'white',
    fontSize: 16,
  },
  loginHighlight: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;