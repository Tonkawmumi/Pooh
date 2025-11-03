import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import { db } from '../firebaseConfig';
import { ref, set, onValue } from 'firebase/database';
import Ionicons from 'react-native-vector-icons/Ionicons';

const PayFineScreen = ({ route, navigation }) => {
    const { username, bookingData, onPaid } = route.params;
    const [overdueMinutes, setOverdueMinutes] = useState(0);
    const [fineAmount, setFineAmount] = useState(0);
    const [originalPrice, setOriginalPrice] = useState(0);
    const [fineRounds, setFineRounds] = useState(0);
    const [paymentCompleted, setPaymentCompleted] = useState(false);
    const [prompayStatus, setPrompayStatus] = useState('pending');

    // ฟังก์ชันจัดรูปแบบตัวเลขด้วยลูกน้ำ
    const formatNumberWithCommas = (number) => {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    // คำนวณค่าปรับ
    const calculateFine = () => {
        if (!bookingData.exitDate) return;

        const now = new Date();
        let exitDateTime;

        // ใช้ exitTime จริงสำหรับทุกประเภทการจอง
        if (bookingData.rateType === 'hourly' && bookingData.exitTime) {
            exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime}`);
        } else if (bookingData.rateType === 'daily' && bookingData.exitTime) {
            exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime}`);
        } else if (bookingData.rateType === 'monthly' && bookingData.exitTime) {
            exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime}`);
        } else {
            // Fallback: ถ้าไม่มี exitTime ให้ใช้ 23:59
            exitDateTime = new Date(`${bookingData.exitDate}T23:59`);
        }

        console.log('Exit DateTime:', exitDateTime);
        console.log('Now:', now);
        console.log('Rate Type:', bookingData.rateType);
        console.log('Exit Time from booking:', bookingData.exitTime);

        const minutesOverdue = Math.max(0, Math.floor((now - exitDateTime) / (1000 * 60)));
        setOverdueMinutes(minutesOverdue);

        // คำนวณรอบค่าปรับ (ทุก 15 นาที)
        const rounds = Math.ceil(minutesOverdue / 15);
        setFineRounds(rounds);

        const price = bookingData.price ? parseFloat(bookingData.price) : 0;
        setOriginalPrice(price);

        let calculatedFineAmount = 0; // ประกาศตัวแปรก่อนใช้

        if (rounds === 0) {
            calculatedFineAmount = 0;
        } else {
            const fineMultiplier = Math.pow(2, rounds);
            const calculatedFine = price * fineMultiplier;
            calculatedFineAmount = Number.isInteger(calculatedFine)
                ? calculatedFine
                : parseFloat(calculatedFine.toFixed(2));
        }

        setFineAmount(calculatedFineAmount);

        console.log('Overdue Minutes:', minutesOverdue);
        console.log('Fine Rounds:', rounds);
        console.log('Fine Amount:', calculatedFineAmount); // ใช้ตัวแปรที่ประกาศแล้ว
    };

    // ดึง status Prompay จาก Firebase แบบ realtime
    useEffect(() => {
        calculateFine();

        const bookingId = bookingData.id;
        if (!bookingId) return;

        const promRef = ref(db, `prompayPayments/${bookingId}`);
        const unsubscribe = onValue(promRef, (snapshot) => {
            if (snapshot.exists()) {
                setPrompayStatus(snapshot.val().status || 'pending');
            }
        });

        return () => unsubscribe();
    }, [bookingData]);

    const handlePaymentSuccess = async () => {
        try {
            const now = new Date();
            const todayDate = now.toISOString().split('T')[0];
            const nowTime = now.toTimeString().split(' ')[0].substring(0,5);

            let roundedFineAmount = Number.isInteger(fineAmount)
                ? fineAmount
                : parseFloat(fineAmount.toFixed(2));

            // ใช้เวลาจริงสำหรับทุกประเภทการจอง
            const payFineData = {
                id: bookingData.id,
                username: bookingData.username || '',
                bookingType: bookingData.bookingType || '',
                rateType: bookingData.rateType || '',
                entryDate: bookingData.entryDate || '',
                exitDate: bookingData.exitDate || '',
                entryTime: bookingData.entryTime || '', // ใช้เวลาจริง
                exitTime: bookingData.exitTime || '',   // ใช้เวลาจริง
                floor: bookingData.floor || '',
                slotId: bookingData.slotId || '',
                price: bookingData.price || 0,
                visitorInfo: bookingData.visitorInfo || null,
                overdueMinutes,
                rounds: fineRounds,
                fineAmount: roundedFineAmount,
                fineIssuedDate: todayDate,
                payFineDate: todayDate,
                payFineTime: nowTime,
                payFineStatus: 'paid'
            };

            await set(ref(db, `payFine/${bookingData.id}`), payFineData);

            setPaymentCompleted(true);

            if (onPaid) onPaid();

            Alert.alert(
                "Payment Successful",
                `Fine of ${formatNumberWithCommas(roundedFineAmount)} baht has been paid successfully.`,
                [{ text: "OK", onPress: () => navigation.navigate('MyParking', { username }) }]
            );
        } catch (error) {
            console.error("Payment error:", error);
            Alert.alert("Error", "Failed to process payment. Please try again.");
        }
    };

    const formatTime = (minutes) => {
        if (minutes < 60) return `${minutes} minutes`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        } catch (error) {
            return dateString;
        }
    };

    // ฟังก์ชันแสดง Due Time ตามประเภทการจอง
    const renderDueTime = () => {
        if (bookingData.rateType === 'hourly') {
            return `${formatDate(bookingData.exitDate)} at ${bookingData.exitTime || '-'}`;
        } else {
            return `${formatDate(bookingData.exitDate)} at ${bookingData.exitTime || '23:59'}`;
        }
    };

    const handleBack = () => navigation.goBack();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Pay Fine</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* Booking Info */}
                <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>Booking Information</Text>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Booking Type:</Text>
                        <Text style={styles.detailValue}>
                            {bookingData.rateType === 'hourly' ? 'Hourly' : 
                             bookingData.rateType === 'daily' ? 'Daily' : 'Monthly'}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Slot:</Text>
                        <Text style={styles.detailValue}>{bookingData.slotId} - Floor {bookingData.floor}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Due Time:</Text>
                        <Text style={styles.detailValue}>
                            {renderDueTime()}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Entry Time:</Text>
                        <Text style={styles.detailValue}>
                            {bookingData.entryTime || '00:00'}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Exit Time:</Text>
                        <Text style={styles.detailValue}>
                            {bookingData.exitTime || '23:59'}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Original Price:</Text>
                        <Text style={styles.detailValue}>{formatNumberWithCommas(Math.round(originalPrice))} baht</Text>
                    </View>

                    {bookingData.bookingType === 'visitor' && bookingData.visitorInfo && (
                        <>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Visitor:</Text>
                                <Text style={styles.detailValue}>{bookingData.visitorInfo.visitorUsername}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Phone:</Text>
                                <Text style={styles.detailValue}>{bookingData.visitorInfo.phoneNumber}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>License Plate:</Text>
                                <Text style={styles.detailValue}>{bookingData.visitorInfo.licensePlate}</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Fine & Payment */}
                {fineAmount > 0 && !paymentCompleted && (
                    <View style={styles.combinedCard}>
                        <View style={styles.fineHeader}>
                            <Ionicons name="warning" size={30} color="#FF6B6B" />
                            <Text style={styles.fineTitle}>Overdue Fine Details</Text>
                        </View>

                        <View style={styles.fineDetail}>
                            <View style={styles.fineRow}>
                                <Text style={styles.fineLabel}>Overdue Time:</Text>
                                <Text style={styles.fineValue}>{formatTime(overdueMinutes)}</Text>
                            </View>

                            <View style={styles.fineRow}>
                                <Text style={styles.fineLabel}>Fine Rounds:</Text>
                                <Text style={styles.fineValue}>{fineRounds} rounds (15 min each)</Text>
                            </View>

                            <View style={styles.fineRow}>
                                <Text style={styles.fineLabel}>Calculation:</Text>
                                <Text style={styles.fineValue}>{formatNumberWithCommas(Math.round(originalPrice))} × 2^{fineRounds}</Text>
                            </View>

                            <View style={styles.divider} />
                            <View style={styles.totalFineSection}>
                                <Text style={styles.totalFineLabel}>TOTAL FINE:</Text>
                                <Text style={styles.totalFineAmount}>{formatNumberWithCommas(fineAmount)} baht</Text>
                            </View>
                            <View style={styles.divider} />

                            <View style={styles.paymentSection}>
                                <Text style={styles.paymentTitle}>Scan QR Code to Pay</Text>
                                <View style={styles.qrContainer}>
                                    <Image source={require('../../assets/images/demo-qr.png')} style={styles.qrImage} resizeMode="contain" />
                                    <View style={styles.prompayStatusRow}>
                                        <Text>Status:</Text>
                                        <Text style={{
                                            fontWeight: '700',
                                            marginLeft: 5,
                                            color: prompayStatus === 'paid' ? 'green' : prompayStatus === 'pending' ? 'orange' : 'red',
                                        }}>
                                            {prompayStatus === 'pending' ? 'Waiting for payment' : prompayStatus === 'paid' ? 'Paid' : 'Failed'}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.confirmButton} onPress={handlePaymentSuccess}>
                                    <Ionicons name="checkmark-circle" size={24} color="white" />
                                    <Text style={styles.confirmButtonText}>Confirm Payment</Text>
                                </TouchableOpacity>
                                <Text style={styles.noteText}>* Scan QR code first, then click Confirm Payment</Text>

                                <View style={styles.explanation}>
                                    <Text style={styles.explanationTitle}>Fine Calculation Rule:</Text>
                                    <Text style={styles.explanationText}>
                                        • 00:01-00:15: 2× price{'\n'}
                                        • 00:16-00:30: 4× price{'\n'}
                                        • 00:31-00:45: 8× price{'\n'}
                                        • 00:46-01:00: 16× price{'\n'}
                                        • ... and doubles every 15 minutes
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {paymentCompleted && (
                    <View style={styles.successCard}>
                        <Ionicons name="checkmark-circle" size={50} color="#4CAF50" />
                        <Text style={styles.successTitle}>Payment Completed!</Text>
                        <Text style={styles.successText}>Your fine of {formatNumberWithCommas(fineAmount)} baht has been paid successfully.</Text>
                    </View>
                )}

                {fineAmount === 0 && (
                    <View style={styles.noFineCard}>
                        <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
                        <Text style={styles.noFineText}>No Fine Required</Text>
                        <Text style={styles.noFineSubtext}>
                            {overdueMinutes === 0 
                                ? "Your booking is not overdue." 
                                : `Overdue ${formatTime(overdueMinutes)} but no fine calculated.`}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#B19CD8',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        paddingTop: 60,
        backgroundColor: '#B19CD8',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
    },
    headerPlaceholder: {
        width: 24,
    },
    scrollContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    infoCard: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 15,
        textAlign: 'center',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 8,
    },
    detailLabel: {
        fontWeight: '600',
        color: '#4A5568',
        fontSize: 14,
    },
    detailValue: {
        fontWeight: '700',
        color: '#2D3748',
        fontSize: 14,
    },
    combinedCard: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    fineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    fineTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FF6B6B',
        marginLeft: 10,
    },
    fineDetail: {
        marginBottom: 15,
    },
    fineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingVertical: 5,
    },
    fineLabel: {
        fontWeight: '600',
        color: '#4A5568',
        fontSize: 14,
    },
    fineValue: {
        fontWeight: '700',
        color: '#2D3748',
        fontSize: 14,
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 10,
    },
    totalFineSection: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        backgroundColor: '#FFF5F5',
        borderRadius: 10,
        marginVertical: 10,
    },
    totalFineLabel: {
        fontWeight: 'bold',
        color: '#FF6B6B',
        fontSize: 16,
        marginBottom: 5,
        textAlign: 'center',
    },
    totalFineAmount: {
        fontWeight: 'bold',
        color: '#FF6B6B',
        fontSize: 28,
        textAlign: 'center',
    },
    paymentSection: {
        marginTop: 10,
    },
    paymentTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2D3748',
        textAlign: 'center',
        marginBottom: 15,
    },
    qrContainer: {
        alignItems: 'center',
        marginVertical: 15,
    },
    qrImage: {
        width: 200,
        height: 200,
        marginBottom: 10,
    },
    confirmButton: {
        backgroundColor: '#4CAF50',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginTop: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    noteText: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: 10,
        fontStyle: 'italic',
    },
    explanation: {
        backgroundColor: '#FFF3CD',
        padding: 15,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#FFC107',
        marginTop: 15,
    },
    explanationTitle: {
        fontWeight: 'bold',
        color: '#856404',
        marginBottom: 5,
    },
    explanationText: {
        color: '#856404',
        fontSize: 12,
        lineHeight: 18,
    },
    successCard: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 30,
        marginBottom: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginTop: 15,
        marginBottom: 10,
    },
    successText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },
    noFineCard: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 30,
        marginBottom: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    noFineText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginTop: 15,
        marginBottom: 5,
    },
    noFineSubtext: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    prompayStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    }
});

export default PayFineScreen;