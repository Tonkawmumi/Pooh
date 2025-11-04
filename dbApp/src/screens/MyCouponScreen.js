import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebaseConfig';
import { ref, get, child } from 'firebase/database';

const MyCouponScreen = ({ route, navigation }) => {
  const { username } = route.params;
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoupons();
    
    // Refresh เมื่อกลับมาที่หน้านี้
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCoupons();
    });
    
    return unsubscribe;
  }, [navigation]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const snapshot = await get(child(ref(db), "coupons"));
      const data = snapshot.val() || {};

      // กรองเฉพาะคูปองของ user นี้ และยังไม่หมดอายุ
      const userCoupons = Object.entries(data)
        .map(([id, coupon]) => ({
          id,
          ...coupon
        }))
        .filter(coupon => {
          // ตรวจสอบ expiryDate (ไม่มีเวลา)
          const expiryDate = new Date(coupon.expiryDate + 'T23:59:59'); // ตั้งเวลาเป็นสิ้นวัน
          const today = new Date();
          today.setHours(0, 0, 0, 0); // ตั้งเวลาเป็น 00:00:00 เพื่อเปรียบเทียบวันที่
          
          return coupon.username === username && expiryDate >= today && !coupon.used;
        })
        .sort((a, b) => {
          // เรียงจากใหม่สุดไปเก่าสุดโดยใช้ createdDate และ createdTime
          const dateTimeA = new Date(a.createdDate + 'T' + (a.createdTime || '00:00'));
          const dateTimeB = new Date(b.createdDate + 'T' + (b.createdTime || '00:00'));
          return dateTimeB - dateTimeA;
        });

      setCoupons(userCoupons);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      Alert.alert("Error", "Unable to fetch coupons.");
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
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

  const getDiscountPercentage = (discountType) => {
    switch (discountType) {
      case 'hourly': return '10%';
      case 'daily': return '20%';
      case 'monthly': return '30%';
      default: return '0%';
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
    const expiry = new Date(expiryDate + 'T23:59:59'); // ตั้งเวลาเป็นสิ้นวัน
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.userInfo}>
            <View style={styles.userIcon}>
              <Ionicons name="person" size={24} color="#B19CD8" />
            </View>
            <View style={styles.userTextContainer}>
              <Text style={styles.userName}>{username}</Text>
            </View>
          </View>

          <View style={styles.headerIcons}>
            <View style={styles.placeholderIcon} />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>My Coupons</Text>
          <Text style={styles.subtitle}>
            {coupons.length > 0 
              ? "Use these coupons for your next booking" 
              : "No active coupons available"}
          </Text>
        </View>

        {coupons.length > 0 ? (
          coupons.map((coupon, index) => {
            const daysLeft = calculateDaysLeft(coupon.expiryDate);
            const isExpiringSoon = daysLeft <= 7;
            
            return (
              <View key={coupon.id} style={[
                styles.couponCard,
                isExpiringSoon && styles.expiringSoonCard
              ]}>
                {isExpiringSoon && (
                  <View style={styles.expiringBadge}>
                    <Ionicons name="time" size={12} color="white" />
                    <Text style={styles.expiringText}>Expiring in {daysLeft} days</Text>
                  </View>
                )}
                
                <View style={styles.couponHeader}>
                  <View style={styles.couponIcon}>
                    <Ionicons name="ticket" size={32} color={getDiscountColor(coupon.discountType)} />
                  </View>
                  <View style={styles.couponInfo}>
                    <Text style={styles.discountText}>
                      {getDiscountText(coupon.discountType)}
                    </Text>
                  </View>
                </View>

                <View style={styles.couponDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Created: {formatDate(coupon.createdDate)} {coupon.createdTime ? `at ${coupon.createdTime}` : ''}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Expires: {formatDate(coupon.expiryDate)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="information-circle-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      {coupon.reason}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="pricetag-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Valid for {coupon.discountType} bookings only
                    </Text>
                  </View>
                </View>

                <View style={[styles.discountBadge, { backgroundColor: getDiscountColor(coupon.discountType) }]}>
                  <Text style={styles.discountBadgeText}>
                    {getDiscountPercentage(coupon.discountType)} OFF
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.noCouponContainer}>
            <Ionicons name="ticket-outline" size={64} color="rgba(255,255,255,0.5)" />
            <Text style={styles.noCouponText}>No active coupons</Text>
            <Text style={styles.noCouponSubtext}>
              You'll receive coupons as compensation for parking inconveniences
            </Text>
          </View>
        )}

        {/* Section อธิบายส่วนลด */}
        <View style={styles.discountInfo}>
          <Text style={styles.discountInfoTitle}>Discount Information</Text>
          <View style={styles.discountItem}>
            <View style={[styles.discountColor, { backgroundColor: '#bb489cff' }]} />
            <Text style={styles.discountItemText}>Hourly Booking: 10% OFF</Text>
          </View>
          <View style={styles.discountItem}>
            <View style={[styles.discountColor, { backgroundColor: '#4e67cdff' }]} />
            <Text style={styles.discountItemText}>Daily Booking: 20% OFF</Text>
          </View>
          <View style={styles.discountItem}>
            <View style={[styles.discountColor, { backgroundColor: '#45B7D1' }]} />
            <Text style={styles.discountItemText}>Monthly Booking: 30% OFF</Text>
          </View>
        </View>
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
    paddingTop: 20,
    alignItems: 'center'
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 25,
    paddingHorizontal: 10,
    marginTop: 40,
  },
  backButton: { 
    padding: 8 
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userTextContainer: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholderIcon: {
    width: 40,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 25,
    width: '100%',
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: 'white', 
    textAlign: 'center' 
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
    textAlign: 'center',
  },
  couponCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  expiringSoonCard: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  expiringBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
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
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  couponIcon: {
    marginRight: 15,
  },
  couponInfo: {
    flex: 1,
  },
  discountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 5,
  },
  couponDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  discountBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  noCouponContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noCouponText: {
    fontSize: 20,
    color: 'white',
    marginTop: 16,
    textAlign: 'center',
  },
  noCouponSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bookButton: {
    backgroundColor: '#575affff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  bookButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  discountInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
    width: '100%',
  },
  discountInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  discountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  discountColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  discountItemText: {
    color: 'white',
    fontSize: 14,
  },
});

export default MyCouponScreen;
