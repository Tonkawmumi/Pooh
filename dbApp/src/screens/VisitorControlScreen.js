import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator 
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { db } from '../firebaseConfig'; 
import { ref, push, get } from 'firebase/database';

const VERCEL_API_URL = "https://pooh-backend.vercel.app"; 

const VisitorControlScreen = ({ route, navigation }) => {
    const { sessionId } = route.params || {}; 
    const sessionKey = sessionId?.includes('-') 
        ? sessionId.substring(0, sessionId.lastIndexOf('-')) 
        : sessionId;

    const [verificationStep, setVerificationStep] = useState('plate');
    const [pageLoading, setPageLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    
    const [inputPlate, setInputPlate] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [errorMessage, setErrorMessage] = useState('');

    const [payFineStatus, setPayFineStatus] = useState('unpaid');
    const [barrierLocked, setBarrierLocked] = useState(true);
    const [bookingData, setBookingData] = useState(null);
    const [isBarrierEnabled, setIsBarrierEnabled] = useState(false);

    // สร้าง refs สำหรับ TextInput แต่ละช่อง
    const otpInputRefs = useRef([]);

    useEffect(() => {
        if (!sessionKey) {
            setPageLoading(false);
            setErrorMessage("Invalid session ID.");
            return;
        }
        
        get(ref(db, `bookings/${sessionKey}`))
            .then(bookingSnap => {
                if (bookingSnap.exists()) {
                    const data = bookingSnap.val();
                    setBookingData(data);
                    checkBarrierAccessTime(data);
                } else {
                    setErrorMessage("Booking not found.");
                }
                setPageLoading(false);
            })
            .catch(error => {
                console.error('Failed to fetch bookingData:', error);
                setErrorMessage("Failed to load booking data.");
                setPageLoading(false);
            });
    }, [sessionKey]);

    const checkBarrierAccessTime = (bookingData) => {
        if (!bookingData) return;

        const now = new Date();
        
        if (bookingData.rateType === 'hourly' && bookingData.exitTime) {
            const entryDateTime = new Date(`${bookingData.entryDate}T${bookingData.entryTime}`);
            const exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime}`);
            
            if (now >= entryDateTime && now <= exitDateTime) {
                setIsBarrierEnabled(true);
            } else {
                setIsBarrierEnabled(false);
            }
        }
        else if (bookingData.rateType === 'daily') {
           const entryDateTime = new Date(`${bookingData.entryDate}T${bookingData.entryTime || '00:00'}`);
            // ใช้เวลาจริงจาก exitTime 
            const exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime || '23:59'}`);
            if (now >= entryDateTime && now <= exitDateTime) {
                setIsBarrierEnabled(true);
            } else {
                setIsBarrierEnabled(false);
            }
        }
        else if (bookingData.rateType === 'monthly') {
           const entryDateTime = new Date(`${bookingData.entryDate}T${bookingData.entryTime || '00:00'}`);
            const exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime || '23:59'}`);
            if (now >= entryDateTime && now <= exitDateTime) {
                setIsBarrierEnabled(true);
            } else {
                setIsBarrierEnabled(false);
            }
        }
    };

    const loadBarrierStatus = () => {
        get(ref(db, `payFine/${sessionKey}`))
            .then(snapshot => {
                const payStatus = snapshot.exists() ? snapshot.val().payFineStatus || 'unpaid' : 'unpaid';
                setPayFineStatus(payStatus);

                const data = bookingData; 
                const now = new Date();

                if (data.rateType === 'hourly') {
                    const exitDateTime = new Date(`${data.exitDate}T${data.exitTime || '23:59'}`); 
                    setBarrierLocked(now > exitDateTime && payStatus !== 'paid');
                } 
                else if (data.rateType === 'daily' || data.rateType === 'monthly') {
                    const exitDateTime = new Date(`${data.exitDate}T${data.exitTime || '23:59'}`);
                    setBarrierLocked(now > exitDateTime && payStatus !== 'paid');
                }

                checkBarrierAccessTime(data);
            })
            .catch(error => console.error('Failed to fetch payFineStatus:', error));
    };

    const handlePlateVerification = async () => {
        if (!bookingData?.visitorInfo?.licensePlate) {
            setErrorMessage("Visitor information not found.");
            return;
        }

        const storedPlate = bookingData.visitorInfo.licensePlate.toLowerCase().trim();
        const input = inputPlate.toLowerCase().trim();

        if (input !== storedPlate) {
            setErrorMessage('License Plate does not match. Please try again.');
            return;
        }

        setActionLoading(true);
        setErrorMessage('');
        
        try {
            const response = await fetch(`${VERCEL_API_URL}/api/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bookingId: sessionKey
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to send OTP.");
            }
            
            setVerificationStep('otp');
            Alert.alert("OTP Sent", `An OTP has been sent to ${bookingData.visitorInfo.email}`);

        } catch (error) {
            console.error("Error sending OTP:", error);
            setErrorMessage(error.message);
        }
        setActionLoading(false);
    };

    // ฟังก์ชันจัดการ OTP แบบใหม่
    const handleOtpChange = (value, index) => {
        // อนุญาตเฉพาะตัวเลข
        if (value && !/^\d+$/.test(value)) return;

        const newOtpDigits = [...otpDigits];
        newOtpDigits[index] = value;
        setOtpDigits(newOtpDigits);

        // ถ้ามีค่าและยังไม่ใช่ช่องสุดท้าย ให้เลื่อนไปช่องถัดไป
        if (value && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyPress = (e, index) => {
        // ถ้ากด Backspace และช่องปัจจุบันว่าง ให้ย้อนกลับไปช่องก่อนหน้า
        if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpVerification = async () => {
        const otp = otpDigits.join('');
        
        if (otp.length < 6) {
            setErrorMessage('Please enter a 6-digit OTP.');
            return;
        }

        setActionLoading(true);
        setErrorMessage('');

        try {
            const response = await fetch(`${VERCEL_API_URL}/api/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bookingId: sessionKey,
                    otp: otp
                }),
            });

            const data = await response.json();

            if (!response.ok || data.verified !== true) {
                throw new Error(data.error || "Invalid or expired OTP.");
            }

            setVerificationStep('verified');
            loadBarrierStatus();

        } catch (error) {
            console.error("Error verifying OTP:", error);
            setErrorMessage(error.message);
        }
        setActionLoading(false);
    };

    const handleResendOtp = async () => {
        // ปิดปุ่มทั้งหมดและล้างข้อผิดพลาด
        setActionLoading(true);
        setErrorMessage('');
        setOtpDigits(['', '', '', '', '', '']); // ล้าง OTP ที่พิมพ์ค้างไว้

        try {
            // เรียก API เพื่อส่ง OTP อีกครั้ง
            const response = await fetch(`${VERCEL_API_URL}/api/send-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    bookingId: sessionKey
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to resend OTP.");
            }
            
            // แจ้งเตือนผู้ใช้
            Alert.alert("OTP Sent", `A new OTP has been sent to ${bookingData.visitorInfo.email}`);
            
            // ย้าย cursor ไปที่ช่องแรก
            otpInputRefs.current[0]?.focus();

        } catch (error) {
            console.error("Error resending OTP:", error);
            setErrorMessage(error.message);
        }
        
        // เปิดปุ่มให้กดได้อีกครั้ง
        setActionLoading(false);
    };

    const handleControl = async (action) => {
        if (!sessionId) {
            Alert.alert("Error", "Session ID is missing.");
            return;
        }
        
        if (!isBarrierEnabled) {
            let message = "Barrier access is only available during your booked time period.";
            
            if (bookingData.rateType === 'hourly') {
                message += `\n\nYour booking period:\n${formatDate(bookingData.entryDate)} ${bookingData.entryTime} - ${formatDate(bookingData.exitDate)} ${bookingData.exitTime}`;
            } else if (bookingData.rateType === 'daily') {
                message += `\n\nYour booking period:\n${formatDate(bookingData.entryDate)} ${bookingData.entryTime || '00:00'} - ${formatDate(bookingData.exitDate)} 23:59`;
            } else {
                message += `\n\nYour booking period:\n${formatDate(bookingData.entryDate)} ${bookingData.entryTime || '00:00'} - ${formatDate(bookingData.exitDate)} 23:59`;
            }
            
            Alert.alert("Barrier Access Not Available", message);
            return;
        }

        if (barrierLocked) {
            Alert.alert("Action not allowed", "Please pay the fine first.");
            return;
        }

        const status = action === 'Open Barrier' ? 'lifted' : 'lowered';
        const now = new Date();
        const actionDate = now.toISOString().slice(0, 10); 
        const actionTime = now.toTimeString().slice(0, 5); 

        try {
            const logRef = ref(db, `bookings/${sessionKey}/barrierLogs`);
            await push(logRef, { status, date: actionDate, time: actionTime });
            Alert.alert("Success", `Barrier action '${status}' has been logged.`);
        } catch (error) {
            console.error("❌ Failed to log barrier action:", error);
            Alert.alert("Error", "Failed to log barrier action.");
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (error) {
            return dateString;
        }
    };

    // --- RENDER FUNCTIONS ---
    if (pageLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="white" />
                <Text style={styles.subtitle}>Loading Session...</Text>
            </View>
        );
    }
    
    if (!bookingData && !pageLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="alert-circle-outline" size={60} color="white" />
                <Text style={styles.title}>Session Error</Text>
                <Text style={styles.subtitle}>{errorMessage || "Could not load session data."}</Text>
            </View>
        );
    }

    const renderPlateInput = () => (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>Verification Required</Text>
                <Text style={styles.subtitle}>Please enter your license plate</Text>
            </View>
            <View style={styles.infoCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="shield-checkmark" size={24} color="#2196F3" />
                    <Text style={styles.cardTitle}>Verify Your Identity</Text>
                </View>
                <TextInput
                    style={styles.inputField} 
                    placeholder="Enter License Plate"
                    value={inputPlate}
                    onChangeText={setInputPlate}
                    autoCapitalize="characters"
                    editable={!actionLoading}
                />
                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                <TouchableOpacity
                    style={[styles.verifyButton, (actionLoading || !inputPlate) && styles.disabledButton]} 
                    onPress={handlePlateVerification}
                    disabled={actionLoading || !inputPlate}
                >
                    {actionLoading 
                        ? <ActivityIndicator color="white" /> 
                        : <Text style={styles.verifyButtonText}>Send OTP</Text>
                    }
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    // แก้ไข renderOtpInput ให้เป็นช่องตัวเลข 6 ช่อง
    const renderOtpInput = () => (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.subtitle}>Check your email for a 6-digit code</Text>
            </View>
            <View style={styles.infoCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="keypad" size={24} color="#4CAF50" />
                    <Text style={styles.cardTitle}>Enter Verification Code</Text>
                </View>
                
                {/* OTP Input Boxes */}
                <View style={styles.otpContainer}>
                    {otpDigits.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={ref => otpInputRefs.current[index] = ref}
                            style={[
                                styles.otpBox,
                                digit ? styles.otpBoxFilled : {},
                            ]}
                            value={digit}
                            onChangeText={(value) => handleOtpChange(value, index)}
                            onKeyPress={(e) => handleOtpKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            editable={!actionLoading}
                            selectTextOnFocus
                        />
                    ))}
                </View>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                
                <TouchableOpacity
                    style={[
                        styles.verifyButton, 
                        (actionLoading || otpDigits.join('').length < 6) && styles.disabledButton
                    ]}
                    onPress={handleOtpVerification}
                    disabled={actionLoading || otpDigits.join('').length < 6}
                >
                    {actionLoading 
                        ? <ActivityIndicator color="white" /> 
                        : <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                    }
                </TouchableOpacity>
                
                <TouchableOpacity 
                    onPress={handleResendOtp} 
                    style={styles.linkButton}
                    disabled={actionLoading} 
                >
                    <Text 
                        style={[
                            styles.linkButtonText,
                            actionLoading && styles.disabledLinkText
                        ]}
                    >
                        Request OTP again
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    const renderBarrierControl = () => (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.header}>
                <Text style={styles.title}>Visitor Control</Text>
                <Text style={styles.subtitle}>Parking Barrier Access</Text>
            </View>
            
            <View style={styles.infoCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="key" size={24} color="#FF9800" />
                    <Text style={styles.cardTitle}>Session Information</Text>
                </View>
                <View style={styles.sessionContainer}>
                    <Text style={styles.sessionLabel}>Session ID:</Text>
                    <Text style={styles.sessionValue}>{sessionId || 'N/A'}</Text>
                </View>
            </View>
            
            <View style={styles.controlCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="car" size={24} color="#2196F3" />
                    <Text style={styles.cardTitle}>Barrier Control</Text>
                </View>
                <Text style={styles.controlDescription}>
                    Tap the buttons below to control the parking barrier
                </Text>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[
                            styles.controlButton, 
                            styles.openButton,
                            (!isBarrierEnabled || barrierLocked) ? { backgroundColor: '#B0BEC5' } : {}
                        ]}
                        onPress={() => handleControl('Open Barrier')}
                        activeOpacity={0.8}
                        disabled={!isBarrierEnabled || barrierLocked}
                    >
                        <View style={styles.buttonContent}>
                            <Ionicons name="arrow-up" size={32} color="white" />
                            <Text style={styles.buttonText}>Lift the barrier up</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.controlButton, 
                            styles.closeButton,
                            (!isBarrierEnabled || barrierLocked) ? { backgroundColor: '#B0BEC5' } : {}
                        ]}
                        onPress={() => handleControl('Close Barrier')}
                        activeOpacity={0.8}
                        disabled={!isBarrierEnabled || barrierLocked}
                    >
                        <View style={styles.buttonContent}>
                            <Ionicons name="arrow-down" size={32} color="white" />
                            <Text style={styles.buttonText}>Lower the barrier down</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 1. ถ้า Barrier ถูกล็อก (ติดค่าปรับ) */}
                {barrierLocked && (
                    <View style={[styles.timeInfoContainer, styles.payFineWarning]}>
                        <Ionicons name="warning-outline" size={16} color="#D32F2F" />
                        <Text style={[styles.timeInfoText, styles.payFineWarningText]}>
                            Please complete the fine payment to unlock the barrier controls.
                        </Text>
                    </View>
                )}

                {/* 2. ถ้าไม่ติดค่าปรับ แต่ยังไม่ถึงเวลา */}
                {!barrierLocked && !isBarrierEnabled && (
                    <View style={styles.timeInfoContainer}>
                        <Ionicons name="time-outline" size={16} color="#FF9800" />
                        <Text style={styles.timeInfoText}>
                            Barrier access available only during booked period:
                        </Text>
                        {bookingData.rateType === 'hourly' ? (
                            <Text style={styles.timeDetailText}>
                                {formatDate(bookingData.entryDate)} {bookingData.entryTime} - {formatDate(bookingData.exitDate)} {bookingData.exitTime}
                            </Text>
                        ) : (
                            <Text style={styles.timeDetailText}>
                                {formatDate(bookingData.entryDate)} {bookingData.entryTime || '00:00'} - {formatDate(bookingData.exitDate)} 23:59
                            </Text>
                        )}
                    </View>
                )}
            </View>
            
            <View style={styles.instructionsCard}>
                <View style={styles.cardHeader}>
                    <Ionicons name="information-circle" size={24} color="#6C757D" />
                    <Text style={styles.cardTitle}>Instructions</Text>
                </View>
                <Text style={styles.instructionText}>• Use "Lift the barrier up" when arriving at the parking</Text>
                <Text style={styles.instructionText}>• Use "Lower the barrier down" after your vehicle has passed</Text>
                <Text style={styles.instructionText}>• Make sure the area is clear before operating</Text>
                <Text style={styles.instructionText}>• Barrier access is only available during your booked time period</Text>
            </View>
        </ScrollView>
    );

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {verificationStep === 'plate' && renderPlateInput()}
            {verificationStep === 'otp' && renderOtpInput()}
            {verificationStep === 'verified' && renderBarrierControl()}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#B19CD8',
    },
    scrollContainer: {
        padding: 20,
        paddingTop: 60,
        alignItems: 'center',
        flexGrow: 1, 
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
    },
    infoCard: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    controlCard: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    instructionsCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        width: '100%',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
        marginLeft: 10,
    },
    sessionContainer: {
        backgroundColor: '#F7FAFC',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    sessionLabel: {
        fontSize: 14,
        color: '#718096',
        marginBottom: 5,
    },
    sessionValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2D3748',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    timeInfoContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 10,
        padding: 10,
        backgroundColor: '#FFF3E0',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFB74D',
    },
    payFineWarning: {
        backgroundColor: '#FFEBEE', // สีแดงอ่อน
        borderColor: '#FFCDD2', // ขอบสีแดง
    },
    payFineWarningText: {
        color: '#D32F2F', // สีแดงเข้ม
        fontWeight: 'bold',
    },
    timeInfoText: {
        color: '#E65100',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 5,
        textAlign: 'center',
    },
    timeDetailText: {
        color: '#E65100',
        fontSize: 11,
        fontWeight: '500',
        textAlign: 'center',
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        padding: 10,
        backgroundColor: '#FFEBEE',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
    warningText: {
        color: '#D32F2F',
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 8,
        flex: 1,
    },
    controlDescription: {
        fontSize: 14,
        color: '#718096',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 20,
    },
    buttonContainer: {
        gap: 15,
    },
    controlButton: {
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 3,
    },
    openButton: {
        backgroundColor: '#4CAF50',
    },
    closeButton: {
        backgroundColor: '#ff4d00ff',
    },
    buttonContent: {
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 8,
        marginBottom: 4,
    },
    instructionText: {
        fontSize: 14,
        color: '#4A5568',
        marginBottom: 8,
        lineHeight: 20,
    },
    inputField: {
        backgroundColor: '#F7FAFC',
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        width: '100%',
        marginTop: 10,
        marginBottom: 10,
        textAlign: 'center',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 20,
        paddingHorizontal: 10,
    },
    otpBox: {
        width: 45,
        height: 55,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2D3748',
        backgroundColor: '#F7FAFC',
    },
    otpBoxFilled: {
        borderColor: '#4CAF50',
        backgroundColor: '#E8F5E9',
    },
    errorText: {
        color: 'red',
        marginTop: 5,
        marginBottom: 10,
        textAlign: 'center',
    },
    verifyButton: {
        backgroundColor: '#4CAF50',
        padding: 16,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    verifyButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    disabledButton: {
        backgroundColor: '#B0BEC5',
    },
    linkButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    linkButtonText: {
        color: '#2196F3',
        textDecorationLine: 'underline',
    },
    disabledLinkText: {
        color: '#B0BEC5',
        textDecorationLine: 'none',
    },
});

export default VisitorControlScreen;