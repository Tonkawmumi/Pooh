import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { ref, get, push, update } from 'firebase/database';

const MyParkingInfoScreen = ({ route, navigation }) => {
    const { username, bookingData } = route.params;
    const [showBarrierModal, setShowBarrierModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [payFineStatus, setPayFineStatus] = useState(null);
    const [showPayFineButton, setShowPayFineButton] = useState(false);
    const [couponDetails, setCouponDetails] = useState(null);
    const [isBarrierEnabled, setIsBarrierEnabled] = useState(false);

    const now = new Date();

    useEffect(() => {
        const fetchCouponDetails = async () => {
            if (bookingData.couponUsed) {
                try {
                    const couponRef = ref(db, `coupons/${bookingData.couponUsed}`);
                    const snapshot = await get(couponRef);
                    if (snapshot.exists()) {
                        setCouponDetails(snapshot.val());
                    }
                } catch (error) {
                    console.error('Failed to fetch coupon details:', error);
                }
            }
        };
        fetchCouponDetails();
    }, [bookingData.couponUsed]);

    // เช็ค payFineStatus จาก Firebase
    useEffect(() => {
        const payFineRef = ref(db, `payFine/${bookingData.id}`);
        get(payFineRef)
            .then(snapshot => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setPayFineStatus(data.payFineStatus === 'paid' ? 'paid' : 'unpaid');
                } else {
                    setPayFineStatus('unpaid');
                }
            })
            .catch(error => {
                console.error('Failed to fetch payFineStatus:', error);
                setPayFineStatus('unpaid');
            });
    }, [bookingData.id]);

    const isPaidFine = payFineStatus === 'paid';

    // Logic ตรวจสอบเวลาเพื่อเปิด/ปิดปุ่ม Barrier
    useEffect(() => {
        const checkBarrierAccessTime = () => {
            // ถ้าเป็น visitor booking ไม่ต้องตรวจสอบเวลา
            if (bookingData.bookingType === 'visitor') {
                setIsBarrierEnabled(true);
                return;
            }

            // ถ้าไม่มีข้อมูลเวลา entry/exit ให้ปิดปุ่ม
            if (!bookingData.entryDate || !bookingData.entryTime || !bookingData.exitDate) {
                setIsBarrierEnabled(false);
                return;
            }

            const now = new Date();
            
            // สำหรับ hourly - ใช้ entryDate+entryTime และ exitDate+exitTime จริง
            if (bookingData.rateType === 'hourly' && bookingData.exitTime) {
                const entryDateTime = new Date(`${bookingData.entryDate}T${bookingData.entryTime}`);
                const exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime}`);
                
                // อนุญาตให้ใช้ barrier เฉพาะในช่วงเวลาจอง
                if (now >= entryDateTime && now <= exitDateTime) {
                    setIsBarrierEnabled(true);
                } else {
                    setIsBarrierEnabled(false);
                }
            }
            // สำหรับ daily - ใช้ entryDate+entryTime และ exitDate+exitTime จริง
            else if (bookingData.rateType === 'daily') {
                const entryDateTime = new Date(`${bookingData.entryDate}T${bookingData.entryTime || '00:00'}`);
                const exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime || '23:59'}`);
                
                // อนุญาตให้ใช้ barrier เฉพาะในช่วงเวลาจอง
                if (now >= entryDateTime && now <= exitDateTime) {
                    setIsBarrierEnabled(true);
                } else {
                    setIsBarrierEnabled(false);
                }
            }
            // สำหรับ monthly - ใช้ entryDate+entryTime และ exitDate+exitTime จริง
            else if (bookingData.rateType === 'monthly') {
                const entryDateTime = new Date(`${bookingData.entryDate}T${bookingData.entryTime || '00:00'}`);
                const exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime || '23:59'}`);
                
                // อนุญาตให้ใช้ barrier เฉพาะในช่วงเวลาจอง
                if (now >= entryDateTime && now <= exitDateTime) {
                    setIsBarrierEnabled(true);
                } else {
                    setIsBarrierEnabled(false);
                }
            }
        };

        checkBarrierAccessTime();
        
        // อัพเดททุกนาทีเพื่อตรวจสอบเวลาแบบ real-time
        const interval = setInterval(checkBarrierAccessTime, 60000);
        return () => clearInterval(interval);
    }, [bookingData]);

    // Logic แสดงปุ่ม Pay Fine
    useEffect(() => {
        if (isPaidFine) {
            setShowPayFineButton(false);
            return;
        }

        const checkPayFineHourly = async () => {
            if (bookingData.rateType === 'hourly' && bookingData.exitDate && bookingData.exitTime) {
                const exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime}`);

                if (now < exitDateTime) {
                    setShowPayFineButton(false);
                    return;
                }

                const barrierRef = ref(db, `bookings/${bookingData.id}/barrierLogs`);
                try {
                    const snapshot = await get(barrierRef);
                    const logs = snapshot.exists() ? snapshot.val() : null;

                    if (!logs) {
                        setShowPayFineButton(true);
                        return;
                    }

                    const sortedLogs = Object.values(logs)
                        .map(l => ({ ...l, datetime: new Date(`${l.date}T${l.time}`) }))
                        .sort((a, b) => a.datetime - b.datetime);

                    let lastLowered = null;
                    let lastLifted = null;

                    for (const log of sortedLogs) {
                        if (log.status === 'lowered') lastLowered = log.datetime;
                        else if (log.status === 'lifted') lastLifted = log.datetime;
                    }

                    let needPayFine = false;

                    if (!lastLowered) {
                        needPayFine = true;
                    } else if (lastLowered <= exitDateTime) {
                        if (!lastLifted || lastLowered < lastLifted) {
                            needPayFine = true;
                        }
                    }

                    setShowPayFineButton(needPayFine);

                } catch (err) {
                    console.error('Failed to fetch barrierLogs:', err);
                    setShowPayFineButton(false);
                }
            }
        };

        const checkPayFineDailyMonthly = () => {
            if ((bookingData.rateType === 'daily' || bookingData.rateType === 'monthly') && bookingData.exitDate && bookingData.exitTime) {
                const exitDateTime = new Date(`${bookingData.exitDate}T${bookingData.exitTime}`);
                
                if (now > exitDateTime) {
                    setShowPayFineButton(true);
                }
            }
        };

        checkPayFineHourly();
        checkPayFineDailyMonthly();
    }, [bookingData, isPaidFine, now]);

    // Helper function to get discount percentage
    const getDiscountPercentage = (discountType) => {
        switch (discountType) {
            case 'hourly': return 10;
            case 'daily': return 20;
            case 'monthly': return 30;
            default: return 0;
        }
    };

    const getDiscountColor = (discountType) => {
        switch (discountType) {
            case 'hourly': return '#bb489cff';
            case 'daily': return '#4e67cdff';
            case 'monthly': return '#45B7D1';
            default: return '#B19CD8';
        }
    };

    const handleBack = () => navigation.goBack();

    const handleControlBarrier = () => {
        if (showPayFineButton) {
            Alert.alert("Action not allowed", "Please pay the fine first.");
            return;
        }
        
        // เพิ่มการตรวจสอบเวลา
        if (!isBarrierEnabled) {
            let message = "Barrier access is only available during your booked time period.";
            
            // แสดงช่วงเวลาที่จองแบบละเอียด
            if (bookingData.rateType === 'hourly') {
                message += `\n\nYour booking period:\n${formatDate(bookingData.entryDate)} ${bookingData.entryTime} - ${formatDate(bookingData.exitDate)} ${bookingData.exitTime}`;
            } else {
                message += `\n\nYour booking period:\n${formatDate(bookingData.entryDate)} ${bookingData.entryTime || '00:00'} - ${formatDate(bookingData.exitDate)} ${bookingData.exitTime || '23:59'}`;
            }
            
            Alert.alert("Barrier Access Not Available", message);
            return;
        }
        
        setShowBarrierModal(true);
    };

    const handleSendInviteLink = () => navigation.navigate('InviteLink', { username, bookingData });
    const handleCancelBooking = () => setShowCancelModal(true);
    
    const handlePayFine = () => {
        const payFineBookingData = {
            ...bookingData,
            exitDate: bookingData.exitDate || bookingData.bookingDate,
            exitTime: bookingData.exitTime || '23:59',
            price: bookingData.price || 0,
        };

        navigation.navigate('PayFine', { 
            username, 
            bookingData: payFineBookingData,
            onPaid: () => setPayFineStatus('paid')
        });
    };

    // Control Barrier Function
    const controlBarrier = (action) => {
        setShowBarrierModal(false);
        const status = action === 'lift' ? 'lifted' : 'lowered';

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        const actionDate = `${year}-${month}-${day}`; 
        const actionTime = `${hours}:${minutes}`;      

        const logRef = ref(db, `bookings/${bookingData.id}/barrierLogs`);
        const newLog = { status, date: actionDate, time: actionTime };

        push(logRef, newLog)
            .then(() => {
                Alert.alert("Success", `The parking barrier has been ${status}.`, [{ text: "OK" }]);
            })
            .catch((error) => {
                Alert.alert("Error", "Failed to log barrier action.");
                console.error(error);
            });
    };

    const confirmCancelBooking = async () => {
        setShowCancelModal(false);
        const slotBookingsRef = ref(db, `parkingSlots/${bookingData.floor}/${bookingData.slotId}`);

        try {
            const snapshot = await get(slotBookingsRef);
            if (!snapshot.exists()) {
                throw new Error("Slot data not found.");
            }

            const slotData = snapshot.val();
            let matchingKey = null;
            const bookingTimeRange = `${bookingData.entryTime}-${bookingData.exitTime}`;

            // หา matchingKey
            for (const key in slotData) {
                const parkedBooking = slotData[key];
                if (typeof parkedBooking === 'object' && parkedBooking !== null) {
                    if (
                        parkedBooking.date === bookingData.entryDate &&
                        parkedBooking.username === bookingData.username &&
                        parkedBooking.timeRange === bookingTimeRange
                    ) {
                        matchingKey = key;
                        break;
                    }
                }
            }

            const updates = {};
            updates[`bookings/${bookingData.id}/status`] = 'cancelled';

            if (matchingKey) {
                updates[`parkingSlots/${bookingData.floor}/${bookingData.slotId}/${matchingKey}`] = null;
            } else {
                console.warn("Could not find matching booking in parkingSlots. Using fallback.");
                updates[`parkingSlots/${bookingData.floor}/${bookingData.slotId}/status`] = 'available';
            }

            await update(ref(db), updates);

            Alert.alert("Success", "Your booking has been cancelled.", [
                { text: "OK", onPress: () => navigation.navigate('MyParking', { username }) }
            ]);

        } catch (error) {
            Alert.alert("Error", "Failed to cancel booking.");
            console.error(error);
        }
    };

    const cancelAction = () => {
        setShowBarrierModal(false);
        setShowCancelModal(false);
    };

    // Format Helpers
    const formatBookingType = (type) => {
        if (type === 'hourly') return 'Hourly';
        if (type === 'daily') return 'Daily';
        if (type === 'monthly') return 'Monthly';
        return type;
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
    const formatTime = (timeString) => {
        if (!timeString) return '-';
        return timeString.includes(':') ? timeString : timeString;
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Parking Details</Text>
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>
                        Slot {bookingData.slotId} - Floor: {bookingData.floor}
                    </Text>

                    {/* Visitor Information */}
                    {bookingData.visitorInfo && (
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionTitle}>Visitor Information</Text>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Visitor Name:</Text>
                                <Text style={styles.detailValue}>{bookingData.visitorInfo.visitorUsername}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Phone Number:</Text>
                                <Text style={styles.detailValue}>{bookingData.visitorInfo.phoneNumber}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Email:</Text>
                                <Text style={styles.detailValue}>{bookingData.visitorInfo.email}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>License Plate:</Text>
                                <Text style={styles.detailValue}>{bookingData.visitorInfo.licensePlate}</Text>
                            </View>
                        </View>
                    )}

                    {/* Booking Information */}
                    <View style={styles.detailSection}>
                        <Text style={styles.sectionTitle}>Booking Information</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Booking ID:</Text>
                            <Text style={styles.detailValue}>{bookingData.id}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Username:</Text>
                            <Text style={styles.detailValue}>{username}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Booking Type:</Text>
                            <Text style={styles.detailValue}>{formatBookingType(bookingData.rateType)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Booking Date:</Text>
                            <Text style={styles.detailValue}>{formatDate(bookingData.bookingDate)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Status:</Text>
                            <Text style={styles.detailValue}>{bookingData.status}</Text>
                        </View>

                        {!bookingData.visitorInfo && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>License Plate:</Text>
                                <Text style={styles.detailValue}>{bookingData.licensePlate}</Text>
                            </View>
                        )}
                    </View>

                    {/* Time Information */}
                    <View style={styles.detailSection}>
                        <Text style={styles.sectionTitle}>Time Information</Text>
                        {bookingData.entryDate && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Entry Date:</Text>
                                <Text style={styles.detailValue}>{formatDate(bookingData.entryDate)}</Text>
                            </View>
                        )}
                        {bookingData.entryTime && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Entry Time:</Text>
                                <Text style={styles.detailValue}>{formatTime(bookingData.entryTime)}</Text>
                            </View>
                        )}
                        {bookingData.exitDate && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Exit Date:</Text>
                                <Text style={styles.detailValue}>{formatDate(bookingData.exitDate)}</Text>
                            </View>
                        )}
                        {bookingData.exitTime && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Exit Time:</Text>
                                <Text style={styles.detailValue}>
                                    {formatTime(bookingData.exitTime)} {/* ✅ แก้ไข: ใช้เวลาจริง */}
                                </Text>
                            </View>
                        )}
                        {bookingData.durationMonths && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Duration (Months):</Text>
                                <Text style={styles.detailValue}>{bookingData.durationMonths}</Text>
                            </View>
                        )}
                    </View>

                    {/* Payment Information */}
                    <View style={styles.detailSection}>
                        <Text style={styles.sectionTitle}>Payment Information</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Payment Status:</Text>
                            <Text
                                style={[
                                    styles.detailValue,
                                    { color: bookingData.paymentStatus === 'paid' ? '#4CAF50' : '#FF9800' }
                                ]}
                            >
                                {bookingData.paymentStatus}
                            </Text>
                        </View>
                        {bookingData.paymentDate && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Payment Date:</Text>
                                <Text style={styles.detailValue}>{formatDate(bookingData.paymentDate)}</Text>
                            </View>
                        )}
                        
                        {/* Original Price (if discount applied) */}
                        {bookingData.originalPrice && bookingData.discount > 0 && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Original Price:</Text>
                                <Text style={[styles.detailValue, styles.strikethrough]}>
                                    {bookingData.originalPrice.toFixed(2)} baht
                                </Text>
                            </View>
                        )}

                        {/* Discount Information */}
                        {bookingData.discount > 0 && couponDetails && (
                            <View style={styles.discountInfoContainer}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Discount Applied:</Text>
                                    <Text style={styles.discountValue}>
                                        -{bookingData.discount.toFixed(2)} baht ({getDiscountPercentage(couponDetails.discountType)}%)
                                    </Text>
                                </View>
                                <View style={[styles.couponBadge, { backgroundColor: getDiscountColor(couponDetails.discountType) }]}>
                                    <Ionicons name="ticket" size={16} color="white" />
                                    <Text style={styles.couponBadgeText}>
                                        Coupon Applied
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Final Price */}
                        <View style={[styles.detailRow, styles.totalPriceRow]}>
                            <Text style={styles.totalPriceLabel}>Total Price:</Text>
                            <Text style={styles.totalPriceValue}>
                                {bookingData.finalPrice 
                                    ? bookingData.finalPrice.toFixed(2) 
                                    : (bookingData.price || 0).toFixed(2)
                                } baht
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsContainer}>
                        <View style={styles.upperButtonRow}>
                            {bookingData.bookingType === 'visitor' ? (
                                <TouchableOpacity style={styles.inviteButton} onPress={handleSendInviteLink}>
                                    <Ionicons name="share" size={20} color="white" />
                                    <Text style={styles.inviteButtonText}>Send Invite Link</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[
                                        styles.barrierButton,
                                        (!isBarrierEnabled || showPayFineButton) ? { backgroundColor: '#B0BEC5' } : {},
                                    ]}
                                    onPress={handleControlBarrier}
                                    disabled={!isBarrierEnabled || showPayFineButton}
                                >
                                    <Ionicons name="lock-open" size={20} color="white" />
                                    <Text style={styles.barrierButtonText}>Control Barrier</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelBooking}>
                                <Ionicons name="close-circle" size={20} color="white" />
                                <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                            </TouchableOpacity>
                        </View>

                       {/* แสดงข้อมูลช่วงเวลาจองเมื่อปุ่ม Barrier ใช้งานไม่ได้ */}

                        {/* 1. ถ้าปุ่ม 'Pay Fine' แสดงขึ้นมา */}
                        {showPayFineButton && bookingData.bookingType !== 'visitor' && (
                            <View style={[styles.timeInfoContainer, styles.payFineWarning]}>
                                <Ionicons name="warning-outline" size={16} color="#D32F2F" />
                                <Text style={[styles.timeInfoText, styles.payFineWarningText]}>
                                    Please complete the fine payment to unlock the barrier controls.
                                </Text>
                            </View>
                        )}

                        {/* 2. ถ้าปุ่ม 'Pay Fine' ไม่แสดง และปุ่ม Barrier ใช้งานไม่ได้ */}
                        {!showPayFineButton && !isBarrierEnabled && bookingData.bookingType !== 'visitor' && (
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
                                        {formatDate(bookingData.entryDate)} {bookingData.entryTime || '00:00'} - {formatDate(bookingData.exitDate)} {bookingData.exitTime || '23:59'}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Render ปุ่ม Pay Fine */}
                        {showPayFineButton && (
                            <View style={styles.payFineWrapper}>
                                <TouchableOpacity style={styles.payFineButton} onPress={handlePayFine}>
                                    <Ionicons name="cash" size={20} color="white" />
                                    <Text style={styles.payFineButtonText}>Pay Fine</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* Barrier Modal */}
                <Modal visible={showBarrierModal} transparent={true} animationType="fade" onRequestClose={cancelAction}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <Ionicons name="car-sport" size={40} color="#FFA000" />
                                <Text style={styles.modalTitle}>Control Parking Barrier</Text>
                            </View>
                            <Text style={styles.modalMessage}>
                                Choose an action for Slot {bookingData.slotId}, Floor: {bookingData.floor}
                            </Text>
                            <View style={styles.modalRowButtons}>
                                <TouchableOpacity style={styles.modalConfirmButton} onPress={() => controlBarrier('lift')}>
                                    <Text style={styles.modalConfirmText}>Lift</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalConfirmButton, { backgroundColor: '#ff4d00ff' }]} onPress={() => controlBarrier('lower')}>
                                    <Text style={styles.modalConfirmText}>Lower</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.modalCancelButtonBottom} onPress={cancelAction}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Cancel Modal */}
                <Modal visible={showCancelModal} transparent={true} animationType="fade" onRequestClose={cancelAction}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <Ionicons name="warning" size={40} color="#FF6B6B" />
                                <Text style={styles.modalTitle}>Cancel Booking</Text>
                            </View>
                            <Text style={styles.modalMessage}>
                                Are you sure you want to cancel this booking for Slot {bookingData.slotId}, Floor {bookingData.floor}?
                            </Text>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.modalCancelButton} onPress={cancelAction}>
                                    <Text style={styles.modalCancelText}>No, Keep It</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalConfirmButton, { backgroundColor: '#FF6B6B' }]} onPress={confirmCancelBooking}>
                                    <Text style={styles.modalConfirmText}>Yes, Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#B19CD8' 
    },
    scrollContainer: { 
        padding: 20, 
        paddingTop: 60, 
        alignItems: 'center' 
    },
    backButton: { 
        position: 'absolute', 
        top: 40, 
        left: 20, 
        zIndex: 1, 
        padding: 8 
    },
    header: { 
        alignItems: 'center', 
        marginBottom: 25, 
        marginTop: 10 
    },
    title: { 
        fontSize: 32, 
        fontWeight: 'bold', 
        color: 'white', 
        textAlign: 'center' 
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
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 20,
        textAlign: 'center',
    },
    detailSection: {
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2D3748',
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
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
        textAlign: 'right',
    },
    strikethrough: {
        textDecorationLine: 'line-through',
        color: '#A0AEC0',
    },
    discountInfoContainer: {
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
        padding: 10,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    discountValue: {
        fontWeight: '700',
        color: '#16A34A',
        fontSize: 14,
    },
    couponBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        marginTop: 8,
        alignSelf: 'center',
    },
    couponBadgeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
        marginLeft: 5,
    },
    totalPriceRow: {
        backgroundColor: '#E8F5E9',
        borderWidth: 2,
        borderColor: '#4CAF50',
        marginTop: 10,
    },
    totalPriceLabel: {
        fontWeight: '700',
        color: '#2D3748',
        fontSize: 16,
    },
    totalPriceValue: {
        fontWeight: '700',
        color: '#4CAF50',
        fontSize: 18,
    },
    actionButtonsContainer: {
        width: '100%',
        marginTop: 10,
    },
    upperButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        width: '100%',
   },
    barrierButton: {
        backgroundColor: '#4CAF50',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        flex: 1,
    },
    barrierButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    inviteButton: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        flex: 1,
    },
    inviteButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    cancelButton: {
        backgroundColor: '#FF6B6B',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        flex: 1,
    },
    cancelButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
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
    payFineWrapper: {
        marginTop: 10,
        width: '100%',
        alignItems: 'center',
    },
    payFineButton: {
        backgroundColor: '#7c40edff',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
    },
    payFineButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 25,
        width: '100%',
        maxWidth: 350,
        alignItems: 'center',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2D3748',
        marginTop: 10,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 16,
        color: '#718096',
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 22,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 10,
    },
    modalCancelButton: {
        backgroundColor: '#F8F9FA',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        flex: 1,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalCancelText: {
        color: '#718096',
        fontWeight: '600',
        fontSize: 16,
    },
    modalConfirmButton: {
        backgroundColor: '#4CAF50',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        flex: 1,
    },
    modalConfirmText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    modalRowButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 10,
        marginBottom: 15,
    },
    modalCancelButtonBottom: {
        backgroundColor: '#E2E8F0',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        width: '50%',
        borderWidth: 1,
        borderColor: '#A0AEC0', 
        alignSelf: 'center',
    },
});

export default MyParkingInfoScreen;