import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, Modal } from 'react-native';
import { db } from '../firebaseConfig';
import { ref, update, get, push, child, onValue } from 'firebase/database';
import Ionicons from 'react-native-vector-icons/Ionicons';

const toLocalISOString = (date) => {
  if (!date || isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (time) => {
  if (!time || isNaN(time.getTime())) return null;
  return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const PaymentScreen = ({ navigation, route }) => {
  const { username, bookingData, selectedSlot, selectedFloor, bookingType } = route.params;
  
  const [localBookingData, setLocalBookingData] = useState(bookingData);
  const [residentLicense, setResidentLicense] = useState('');
  const [prompayStatus, setPrompayStatus] = useState('pending');
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [originalPrice, setOriginalPrice] = useState(0);
  const [discountedPrice, setDiscountedPrice] = useState(0);

  useEffect(() => {
    if (
      bookingData.rateType === 'hourly' &&
      bookingData.durationHours &&
      bookingData.entryDate &&
      bookingData.entryTime
    ) {
      try {
        const entryDateTime = new Date(`${bookingData.entryDate}T${bookingData.entryTime}`);
        const exitDateTime = new Date(
          entryDateTime.getTime() + bookingData.durationHours * 60 * 60 * 1000
        );

        const newExitDate = toLocalISOString(exitDateTime);
        const newExitTime = formatTime(exitDateTime);

        if (newExitDate !== localBookingData.exitDate || newExitTime !== localBookingData.exitTime) {
          setLocalBookingData((prevData) => ({
            ...prevData,
            exitDate: newExitDate,
            exitTime: newExitTime,
          }));
        }
      } catch (error) {
        console.error("Error recalculating exit time:", error);
        setLocalBookingData(bookingData);
      }
    } else {
      setLocalBookingData(bookingData);
    }
  }, [bookingData]);

  const fetchUserBookings = async () => {
    try {
      const snapshot = await get(child(ref(db), 'users'));
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const currentUser = Object.values(usersData).find(u => u.username === username);
        if (currentUser) {
          setResidentLicense(currentUser.licensePlate || '-');
        }
      }
    } catch (error) {
      console.error(error);
      setResidentLicense('-');
    }
  };

  const fetchMatchingCoupons = async () => {
    try {
      const snapshot = await get(child(ref(db), "coupons"));
      const data = snapshot.val() || {};

      const userCoupons = Object.entries(data)
        .map(([id, coupon]) => ({
          id,
          ...coupon
        }))
        .filter(coupon => {
          const expiryDate = new Date(coupon.expiryDate + 'T23:59:59');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          return (
            coupon.username === username && 
            expiryDate >= today && 
            !coupon.used &&
            coupon.discountType === localBookingData.rateType
          );
        })
        .sort((a, b) => {
          const dateTimeA = new Date(a.createdDate + 'T' + (a.createdTime || '00:00'));
          const dateTimeB = new Date(b.createdDate + 'T' + (b.createdTime || '00:00'));
          return dateTimeB - dateTimeA;
        });

      setAvailableCoupons(userCoupons);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      setAvailableCoupons([]);
    }
  };

  const calculatePrice = () => {
    let price = 0;
    switch (localBookingData.rateType) {
      case 'hourly':
        price = localBookingData.price || 0;
        break;
      case 'daily':
        price = localBookingData.price || 0;
        break;
      case 'monthly':
        price = (localBookingData.durationMonths || 1) * 3000;
        break;
      default:
        price = 0;
    }
    setOriginalPrice(price);
    
    if (selectedCoupon) {
      const discountPercent = getDiscountPercentage(selectedCoupon.discountType);
      const discount = price * (discountPercent / 100);
      setDiscountedPrice(price - discount);
    } else {
      setDiscountedPrice(price);
    }
  };

  useEffect(() => {
    fetchUserBookings();
    
    const bookingId = localBookingData.id;
    if (!bookingId) return;

    const promRef = ref(db, `prompayPayments/${bookingId}`);
    const unsubscribe = onValue(promRef, (snapshot) => {
      if (snapshot.exists()) {
        setPrompayStatus(snapshot.val().status || 'pending');
      }
    });

    return () => unsubscribe();
  }, [localBookingData.id]);

  useEffect(() => {
    if (localBookingData.rateType) {
      fetchMatchingCoupons();
    }
    calculatePrice();
  }, [selectedCoupon, localBookingData]);

  const getDiscountPercentage = (discountType) => {
    switch (discountType) {
      case 'hourly': return 10;
      case 'daily': return 20;
      case 'monthly': return 30;
      default: return 0;
    }
  };

  const getDiscountText = (discountType) => {
    switch (discountType) {
      case 'hourly': return '10% off Hourly Booking';
      case 'daily': return '20% off Daily Booking';
      case 'monthly': return '30% off Monthly Booking';
      default: return 'Discount Coupon';
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDaysLeft = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate + 'T23:59:59');
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSelectCoupon = (coupon) => {
    setSelectedCoupon(coupon);
    setShowCouponModal(false);
  };

  const handleRemoveCoupon = () => {
    setSelectedCoupon(null);
  };

  const handlePaymentSuccess = async () => {
    try {
      const updates = {};
      const now = new Date();
      const bookingDate = now.toISOString().slice(0, 10);

      let entryDate = localBookingData.entryDate;
      let exitDate = localBookingData.exitDate;
      let slotDate;
      let slotTimeRange;

      if (localBookingData.rateType === 'hourly') {
        slotDate = localBookingData.entryDate;
        const startTime = localBookingData.entryTime; 
        const endTime = localBookingData.exitTime; 
        slotTimeRange = `${startTime}-${endTime}`;
        
      } else if (localBookingData.rateType === 'daily') { 
        slotDate = `${localBookingData.entryDate} - ${localBookingData.exitDate}`;
        
        // ดึงเวลาจริงมาใช้
        const startTime = localBookingData.entryTime; 
        const endTime = localBookingData.exitTime;
        slotTimeRange = `${startTime}-${endTime}`; // ใช้เวลาจริง

      } else if (localBookingData.rateType === 'monthly') {
        slotDate = `${localBookingData.entryDate} - ${localBookingData.exitDate}`;
        slotTimeRange = '00:00-23:59'; 
      }

      const usernameToSave =
        bookingType === 'resident'
          ? username
          : localBookingData.visitorInfo?.visitorUsername || username;

      const newSlotBooking = {
        date: slotDate,
        timeRange: slotTimeRange,
        available: false,
        status: 'booked',
        username: usernameToSave,
      };

      const slotRef = ref(db, `parkingSlots/${selectedFloor}/${selectedSlot}`);
      const slotSnap = await get(slotRef);

      let updatedSlotData = [];
      if (!slotSnap.exists() || slotSnap.val().status === 'available') {
        updatedSlotData = [newSlotBooking];
      } else if (Array.isArray(slotSnap.val())) {
        const existingBookings = slotSnap.val();
        const isDuplicate = existingBookings.some(
          (b) => b.date === newSlotBooking.date && b.timeRange === newSlotBooking.timeRange
        );
        updatedSlotData = isDuplicate ? existingBookings : [...existingBookings, newSlotBooking];
      } else {
        updatedSlotData = [newSlotBooking];
      }

      updates[`parkingSlots/${selectedFloor}/${selectedSlot}`] = updatedSlotData;

      const newBookingRef = push(ref(db, 'bookings'));
      const newBookingId = newBookingRef.key;

      const licensePlateToSave =
        bookingType === 'resident'
          ? residentLicense || '-'
          : localBookingData.visitorInfo?.licensePlate || '-';

      const newBooking = {
        ...localBookingData,
        id: newBookingId,
        username,
        bookingType,
        status: 'confirmed',
        slotId: selectedSlot,
        floor: selectedFloor,
        entryDate,
        exitDate,
        entryTime: localBookingData.entryTime,
        exitTime: localBookingData.exitTime,
        bookingDate,
        paymentStatus: 'paid',
        paymentDate: bookingDate,
        visitorInfo: localBookingData.visitorInfo || null,
        licensePlate: licensePlateToSave,
        originalPrice: originalPrice,
        finalPrice: discountedPrice,
        couponUsed: selectedCoupon ? selectedCoupon.id : null,
        discount: selectedCoupon ? originalPrice - discountedPrice : 0,
      };

      updates[`bookings/${newBookingId}`] = newBooking;

      if (selectedCoupon) {
        updates[`coupons/${selectedCoupon.id}/used`] = true;
        updates[`coupons/${selectedCoupon.id}/usedDate`] = bookingDate;
        updates[`coupons/${selectedCoupon.id}/usedBookingId`] = newBookingId;
      }

      await update(ref(db), updates);

      Alert.alert('Success', 'Payment successful and slot reserved!', [
        {
          text: 'OK',
          onPress: () =>
            navigation.navigate('MyParking', {
              username,
              userType: bookingType,
            }),
        },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Payment failed. Please try again.');
    }
  };

  const handleBack = () => navigation.goBack();

  const renderBookingDetail = (label, value) => (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}:</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );

  const formatBookingType = type => {
    if (type === 'hourly') return 'Hourly';
    if (type === 'daily') return 'Daily';
    if (type === 'monthly') return 'Monthly';
    return String(type);
  };

  const renderBookedBy = () => {
    if (bookingType === 'resident') {
      return <Text style={styles.value}>{username}</Text>;
    } else if (bookingType === 'visitor' && localBookingData.visitorInfo) {
      return (
        <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
          <Text style={styles.value}>{username}</Text>
          <Text style={[styles.value, { fontSize: 13, color: '#718096' }]}>
            (for {localBookingData.visitorInfo.visitorUsername})
          </Text>
        </View>
      );
    }
    return <Text style={styles.value}>{username}</Text>;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Payment</Text>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.cardTitle}>Booking Details</Text>

          {renderBookingDetail('User Type', bookingType === 'resident' ? 'Resident' : 'Visitor')}
          {renderBookingDetail('Booking Type', formatBookingType(localBookingData.rateType))}
          {renderBookingDetail('Booked By', renderBookedBy())}
          {renderBookingDetail('Slot', selectedSlot)}
          {renderBookingDetail('Floor', selectedFloor)}
          {localBookingData.entryDate && renderBookingDetail('Entry Date', localBookingData.entryDate)}
          {localBookingData.entryTime && renderBookingDetail('Entry Time', localBookingData.entryTime)}
          {localBookingData.exitDate && renderBookingDetail('Exit Date', localBookingData.exitDate)}
          {localBookingData.exitTime && renderBookingDetail('Exit Time', localBookingData.exitTime)}
          {renderBookingDetail('License Plate', residentLicense)}
          {localBookingData.durationMonths &&
            renderBookingDetail('Duration (Months)', localBookingData.durationMonths)}
          
          {localBookingData.rateType === 'hourly' && localBookingData.durationHours &&
            renderBookingDetail('Duration (Hours)', localBookingData.durationHours)}

          {bookingType === 'visitor' && localBookingData.visitorInfo && (
            <View style={styles.visitorSection}>
              <Text style={styles.sectionTitle}>Visitor Information</Text>
              {renderBookingDetail('Visitor Name', localBookingData.visitorInfo.visitorUsername)}
              {renderBookingDetail('Phone', localBookingData.visitorInfo.phoneNumber)}
              {renderBookingDetail('Email', localBookingData.visitorInfo.email)}
              {renderBookingDetail('License Plate', localBookingData.visitorInfo.licensePlate)}
            </View>
          )}

          <View style={styles.couponSection}>
            <Text style={styles.sectionTitle}>Discount Coupon</Text>
            {selectedCoupon ? (
              <View style={styles.selectedCouponContainer}>
                <View style={styles.selectedCouponInfo}>
                  <Ionicons name="ticket" size={24} color={getDiscountColor(selectedCoupon.discountType)} />
                  <View style={styles.selectedCouponText}>
                    <Text style={styles.selectedCouponTitle}>
                      {getDiscountText(selectedCoupon.discountType)}
                    </Text>
                    <Text style={styles.selectedCouponExpiry}>
                      Expires: {formatDate(selectedCoupon.expiryDate)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleRemoveCoupon} style={styles.removeCouponButton}>
                  <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.selectCouponButton}
                onPress={() => setShowCouponModal(true)}
                disabled={availableCoupons.length === 0}
              >
                <Ionicons name="ticket-outline" size={20} color={availableCoupons.length > 0 ? "#B19CD8" : "#CCC"} />
                <Text style={[styles.selectCouponText, availableCoupons.length === 0 && styles.disabledText]}>
                  {availableCoupons.length > 0 
                    ? `Select Coupon (${availableCoupons.length} available)` 
                    : 'No coupons available'}
                </Text>
                {availableCoupons.length > 0 && <Ionicons name="chevron-forward" size={20} color="#B19CD8" />}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.qrContainer}>
            <Image
              source={require('../../assets/images/demo-qr.png')}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.priceSection}>
            {selectedCoupon && (
              <>
                <View style={styles.priceRow}>
                  <Text style={styles.discountLabel}>
                    Discount ({getDiscountPercentage(selectedCoupon.discountType)}%):
                  </Text>
                  <Text style={styles.discountValue}>
                    -{(originalPrice - discountedPrice).toFixed(2)} baht
                  </Text>
                </View>
                <View style={styles.divider} />
              </>
            )}
            
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalAmount}>{discountedPrice.toFixed(2)} baht</Text>
            </View>
          </View>

          <View style={styles.prompaySection}>
            <Text style={styles.sectionTitle}>Pay Prompay</Text>
            <Text>Scan the QR code to pay</Text>

            <View style={styles.prompayStatusRow}>
              <Text>Status:</Text>
              <Text style={{ 
                fontWeight: '700', 
                color: prompayStatus === 'paid' ? 'green' : prompayStatus === 'pending' ? 'orange' : 'red',
              }}>
                {prompayStatus === 'pending' ? 'Waiting for payment' : prompayStatus === 'paid' ? 'Paid' : 'Failed'}
              </Text>
            </View>

            {prompayStatus === 'pending' && (
              <Text style={{ fontSize: 12, color: '#718096', marginTop: 5 }}>
                Payment will be recorded automatically once transfer is detected.
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.payButton} onPress={handlePaymentSuccess}>
          <Text style={styles.payButtonText}>Pay & Confirm</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCouponModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCouponModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Coupon</Text>
              <TouchableOpacity onPress={() => setShowCouponModal(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.couponList}>
              {availableCoupons.length > 0 ? (
                availableCoupons.map((coupon) => {
                  const daysLeft = calculateDaysLeft(coupon.expiryDate);
                  const isExpiringSoon = daysLeft <= 7;
                  
                  return (
                    <TouchableOpacity
                      key={coupon.id}
                      style={[
                        styles.couponItem,
                        isExpiringSoon && styles.expiringSoonBorder
                      ]}
                      onPress={() => handleSelectCoupon(coupon)}
                    >
                      {isExpiringSoon && (
                        <View style={styles.expiringBadge}>
                          <Ionicons name="time" size={12} color="white" />
                          <Text style={styles.expiringText}>Expiring in {daysLeft} days</Text>
                        </View>
                      )}
                      
                      <View style={styles.couponItemHeader}>
                        <Ionicons name="ticket" size={32} color={getDiscountColor(coupon.discountType)} />
                        <View style={styles.couponItemInfo}>
                          <Text style={styles.couponItemTitle}>
                            {getDiscountText(coupon.discountType)}
                          </Text>
                          <Text style={styles.couponItemExpiry}>
                            Expires: {formatDate(coupon.expiryDate)}
                          </Text>
                        </View>
                        <View style={[styles.couponBadge, { backgroundColor: getDiscountColor(coupon.discountType) }]}>
                          <Text style={styles.couponBadgeText}>
                            {getDiscountPercentage(coupon.discountType)}% OFF
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={styles.couponReason}>{coupon.reason}</Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.noCouponsContainer}>
                  <Ionicons name="ticket-outline" size={64} color="#CCC" />
                  <Text style={styles.noCouponsText}>No coupons available</Text>
                  <Text style={styles.noCouponsSubtext}>
                    No matching coupons for {formatBookingType(localBookingData.rateType)} booking
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2D3748',
    textAlign: 'center',
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  label: {
    fontWeight: '600',
    color: '#4A5568',
    fontSize: 14,
  },
  value: {
    fontWeight: '700',
    color: '#2D3748',
    fontSize: 14,
    textAlign: 'right',
  },
  visitorSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 15,
  },
  couponSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  selectCouponButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  selectCouponText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '500',
  },
  disabledText: {
    color: '#CCC',
  },
  selectedCouponContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  selectedCouponInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedCouponText: {
    marginLeft: 10,
    flex: 1,
  },
  selectedCouponTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
  },
  selectedCouponExpiry: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 2,
  },
  removeCouponButton: {
    padding: 5,
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  qrImage: {
    width: 170,
    height: 170,
  },
  priceSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#4A5568',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#A0AEC0',
  },
  discountLabel: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#B19CD8',
  },
  payButton: {
    backgroundColor: '#B19CD8',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  prompaySection: {
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  prompayStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
  },
  couponList: {
    padding: 15,
  },
  couponItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  expiringSoonBorder: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  expiringBadge: {
    position: 'absolute',
    top: -10,
    left: 15,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  expiringText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  couponItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  couponItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  couponItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  couponItemExpiry: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  couponBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
  },
  couponBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 11,
  },
  couponReason: {
    fontSize: 13,
    color: '#4A5568',
    fontStyle: 'italic',
    marginTop: 5,
  },
  noCouponsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noCouponsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 15,
  },
  noCouponsSubtext: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default PaymentScreen;