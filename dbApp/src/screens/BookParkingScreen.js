import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width: screenWidth } = Dimensions.get('window');

// ✅ Constants สำหรับ rates
const RATES = {
  hourly: { price: 40, label: 'Hourly', display: '40 baht/hour' },
  daily: { price: 250, label: 'Daily', display: '250 baht/day' },
  monthly: { price: 3000, label: 'Monthly', display: '3,000 baht/month' }
};

const toLocalISOString = (date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const BookParkingScreen = ({ navigation, route }) => {
  const { username, bookingType, visitorInfo, licensePlate } = route.params;
  const [selectedRate, setSelectedRate] = useState(null);
  const [entryDate, setEntryDate] = useState(new Date());
  const [entryTime, setEntryTime] = useState(new Date());
  const [exitDate, setExitDate] = useState(new Date());
  const [exitTime, setExitTime] = useState(new Date());
  const [residentLicensePlate] = useState(licensePlate || '');
  
  // State สำหรับการจองรายเดือน
  const [durationMonths, setDurationMonths] = useState(1);
  // State สำหรับการจองรายชั่วโมง
  const [durationHours, setDurationHours] = useState(1);
  // State สำหรับการจองรายวัน
  const [durationDays, setDurationDays] = useState(1);

  const [pickerMode, setPickerMode] = useState(null); 
  const [showPicker, setShowPicker] = useState(false);

  const hasSetMonthlyTimes = useRef(false);

  // ✅ ใช้ useMemo สำหรับ rates array
  const rates = useMemo(() => [
    { id: 'hourly', label: RATES.hourly.label, price: RATES.hourly.display },
    { id: 'daily', label: RATES.daily.label, price: RATES.daily.display },
    { id: 'monthly', label: RATES.monthly.label, price: RATES.monthly.display }
  ], []);

  // ✅ ใช้ useMemo สำหรับ options
  const hourOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const dayOptions = useMemo(() => Array.from({ length: 7 }, (_, i) => i + 1), []);

  // ✅ แก้ไข: Logic คำนวณเวลาออก สำหรับ hourly และ daily
  useEffect(() => {
    if (selectedRate === 'hourly') {
      const entryDateTime = new Date(entryDate);
      entryDateTime.setHours(entryTime.getHours(), entryTime.getMinutes(), 0, 0);
      const exitDateTime = new Date(entryDateTime.getTime() + durationHours * 60 * 60 * 1000);
      
      setExitDate(prev => {
        const newDateString = exitDateTime.toDateString();
        return prev.toDateString() === newDateString ? prev : new Date(exitDateTime);
      });
      
      setExitTime(prev => {
        const newTimeString = exitDateTime.toTimeString();
        return prev.toTimeString() === newTimeString ? prev : new Date(exitDateTime);
      });

    } else if (selectedRate === 'daily') {
      const newExit = new Date(entryDate);
      newExit.setDate(newExit.getDate() + durationDays);
      
      setExitDate(prev => {
        const newDateString = newExit.toDateString();
        return prev.toDateString() === newDateString ? prev : new Date(newExit);
      });
      
      // ✅ แก้ไข: สำหรับ daily booking ให้ exitTime เท่ากับ entryTime
      setExitTime(prev => {
        const newTimeString = entryTime.toTimeString();
        return prev.toTimeString() === newTimeString ? prev : new Date(entryTime);
      });
    }
  }, [entryDate, entryTime, durationHours, durationDays, selectedRate]);

  // ✅ แก้ไข: Logic คำนวณเวลาออก สำหรับ monthly
  useEffect(() => {
    if (selectedRate === 'monthly') {
      const newExit = new Date(entryDate);
      newExit.setMonth(newExit.getMonth() + durationMonths);
      
      setExitDate(prev => {
        const newDateString = newExit.toDateString();
        return prev.toDateString() === newDateString ? prev : new Date(newExit);
      });
      
      // ตั้งค่าเวลา default เพียงครั้งเดียวเมื่อเปลี่ยนเป็น monthly
      if (!hasSetMonthlyTimes.current) {
        const defaultEntryTime = new Date(entryDate);
        defaultEntryTime.setHours(0, 0, 0, 0);
        setEntryTime(defaultEntryTime);
        
        // ✅ แก้ไข: สำหรับ monthly ให้ exitTime เท่ากับ entryTime
        const defaultExitTime = new Date(entryDate);
        defaultExitTime.setHours(0, 0, 0, 0);
        setExitTime(defaultExitTime);
        
        hasSetMonthlyTimes.current = true;
      }
    } else {
      // รีเซ็ตเมื่อเปลี่ยนไปใช้ rate อื่น
      hasSetMonthlyTimes.current = false;
    }
  }, [entryDate, durationMonths, selectedRate]);

  // ✅ ใช้ constants ในการคำนวณราคา
  const calculatePrice = useCallback(() => {
    if (!selectedRate) return 0;
    switch (selectedRate) {
      case 'hourly': 
        return durationHours * RATES.hourly.price;
      case 'daily': 
        return durationDays * RATES.daily.price;
      case 'monthly':
        return durationMonths * RATES.monthly.price;
      default:
        return 0;
    }
  }, [selectedRate, durationHours, durationDays, durationMonths]);

  const formatDate = useCallback((date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), []);

  const formatTime = useCallback((time) =>
    time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), []);

  const onChangeDateTime = useCallback((event, selectedValue) => {
    setShowPicker(false);
    if (!selectedValue) return;

    switch (pickerMode) {
      case 'entryDate':
        setEntryDate(selectedValue);
        break;
      case 'entryTime': 
        setEntryTime(selectedValue);
        break;
    }
  }, [pickerMode]);

  const handleSearch = useCallback(() => {
    if (!selectedRate) {
      Alert.alert('Error', 'Please select a parking rate');
      return;
    }

    const now = new Date();
    const entryDateTime = new Date(
      entryDate.getFullYear(),
      entryDate.getMonth(),
      entryDate.getDate(),
      entryTime.getHours(),
      entryTime.getMinutes()
    );

    // ✅ แก้ไข: เพิ่ม tolerance สำหรับ daily/monthly
    const tolerance = (selectedRate === 'daily' || selectedRate === 'monthly') ? 0 : 60000; // 1 minute for hourly
    if (entryDateTime < new Date(now.getTime() - tolerance)) {
      Alert.alert('Error', 'Entry date/time cannot be in the past.');
      return;
    }

    const exitDateTime = new Date(exitDate);
    if (selectedRate === 'hourly') {
      exitDateTime.setHours(exitTime.getHours(), exitTime.getMinutes(), 0, 0);
    }

    const price = calculatePrice();

    const bookingData = {
      username,
      bookingType,
      rateType: selectedRate,
      createdAt: new Date().toISOString(),
      price,
      entryDate: toLocalISOString(entryDate),
      exitDate: toLocalISOString(exitDateTime),
      bookingDate: toLocalISOString(new Date()), 
      licensePlate: bookingType === 'resident' ? residentLicensePlate : undefined,
      entryTime: formatTime(entryTime),
      // ✅ แก้ไข: สำหรับ daily และ monthly ให้ใช้เวลาเดียวกับ entryTime
      exitTime: selectedRate === 'hourly' ? formatTime(exitTime) : formatTime(entryTime),
    };

    if (selectedRate === 'hourly') {
      bookingData.durationHours = durationHours;
    } else if (selectedRate === 'daily') {
      bookingData.durationDays = durationDays;
    } else if (selectedRate === 'monthly') {
      bookingData.durationMonths = durationMonths;
    }

    navigation.navigate('Reservation', {
      username,
      bookingData: {
        ...bookingData,
        visitorInfo
      },
      bookingType
    });
  }, [selectedRate, entryDate, entryTime, exitDate, exitTime, durationHours, durationDays, durationMonths, 
      calculatePrice, formatTime, username, bookingType, residentLicensePlate, visitorInfo, navigation]);

  const handleBack = useCallback(() => {
    navigation.navigate('BookingType', { username, residentLicensePlate });
  }, [navigation, username, residentLicensePlate]);

  // ✅ Component สำหรับเลือกชั่วโมง (แบบง่าย)
  const HourlyDurationSelector = () => (
    <View style={styles.durationCard}>
      <Text style={styles.durationLabel}>Parking Duration: {durationHours} hour{durationHours > 1 ? 's' : ''}</Text>
      <View style={styles.selectorContainer}>
        <TouchableOpacity 
          style={[styles.selectorButton, durationHours <= 1 && styles.selectorButtonDisabled]}
          onPress={() => setDurationHours(prev => Math.max(1, prev - 1))}
          disabled={durationHours <= 1}
        >
          <Ionicons name="remove" size={24} color={durationHours <= 1 ? '#ccc' : '#B19CD8'} />
        </TouchableOpacity>
        
        <View style={styles.durationDisplay}>
          <Text style={styles.durationValue}>{durationHours}</Text>
          <Text style={styles.durationUnit}>hours</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.selectorButton, durationHours >= 12 && styles.selectorButtonDisabled]}
          onPress={() => setDurationHours(prev => Math.min(12, prev + 1))}
          disabled={durationHours >= 12}
        >
          <Ionicons name="add" size={24} color={durationHours >= 12 ? '#ccc' : '#B19CD8'} />
        </TouchableOpacity>
      </View>
      <Text style={styles.durationHelpText}>
        Select duration from 1 to 12 hours
      </Text>
    </View>
  );

  // ✅ Component สำหรับเลือกวัน (แบบง่าย)
  const DailyDurationSelector = () => (
    <View style={styles.durationCard}>
      <Text style={styles.durationLabel}>Parking Duration: {durationDays} day{durationDays > 1 ? 's' : ''}</Text>
      <View style={styles.selectorContainer}>
        <TouchableOpacity 
          style={[styles.selectorButton, durationDays <= 1 && styles.selectorButtonDisabled]}
          onPress={() => setDurationDays(prev => Math.max(1, prev - 1))}
          disabled={durationDays <= 1}
        >
          <Ionicons name="remove" size={24} color={durationDays <= 1 ? '#ccc' : '#B19CD8'} />
        </TouchableOpacity>
        
        <View style={styles.durationDisplay}>
          <Text style={styles.durationValue}>{durationDays}</Text>
          <Text style={styles.durationUnit}>days</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.selectorButton, durationDays >= 7 && styles.selectorButtonDisabled]}
          onPress={() => setDurationDays(prev => Math.min(7, prev + 1))}
          disabled={durationDays >= 7}
        >
          <Ionicons name="add" size={24} color={durationDays >= 7 ? '#ccc' : '#B19CD8'} />
        </TouchableOpacity>
      </View>
      <Text style={styles.durationHelpText}>
        Select duration from 1 to 7 days
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Book Parking</Text>
        </View>

        {/* เลือก rate */}
        <View style={styles.section}>
          <View style={styles.ratesContainer}>
            {rates.map((rate) => (
              <TouchableOpacity
                key={rate.id}
                style={[styles.rateButton, selectedRate === rate.id && styles.selectedRateButton]}
                onPress={() => setSelectedRate(rate.id)}
              >
                <Text style={[styles.rateLabel, selectedRate === rate.id && styles.selectedRateLabel]}>
                  {rate.label}
                </Text>
                <Text style={[styles.ratePrice, selectedRate === rate.id && styles.selectedRatePrice]}>
                  {rate.price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* เลือกวันเวลา */}
        {(selectedRate === 'hourly' || selectedRate === 'daily' || selectedRate === 'monthly') && (
          <View style={styles.inputGroup}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Entry Date</Text>
              <TouchableOpacity
                style={styles.dateTimeBox}
                onPress={() => { setPickerMode('entryDate'); setShowPicker(true); }}
              >
                <Text style={styles.dateTimeValue}>{formatDate(entryDate)}</Text>
                <Ionicons name="calendar" size={22} color="#B19CD8" style={{ marginLeft: 10 }} />
              </TouchableOpacity>
            </View>

            {(selectedRate === 'hourly' || selectedRate === 'daily') && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Entry Time</Text>
                <TouchableOpacity
                  style={styles.dateTimeBox}
                  onPress={() => { setPickerMode('entryTime'); setShowPicker(true); }}
                >
                  <Text style={styles.dateTimeValue}>{formatTime(entryTime)}</Text>
                  <Ionicons name="time" size={22} color="#B19CD8" style={{ marginLeft: 10 }} />
                </TouchableOpacity>
              </View>
            )}

            {selectedRate === 'hourly' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Parking Duration</Text>
                  <HourlyDurationSelector />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Exit Date</Text>
                  <View style={styles.readOnlyBox}>
                    <Text style={styles.dateTimeValue}>{formatDate(exitDate)}</Text>
                  </View>
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Exit Time</Text>
                  <View style={styles.readOnlyBox}>
                    <Text style={styles.dateTimeValue}>{formatTime(exitTime)}</Text>
                  </View>
                </View>
              </>
            )}

            {selectedRate === 'daily' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Parking Duration</Text>
                  <DailyDurationSelector />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Exit Date</Text>
                  <View style={styles.readOnlyBox}>
                    <Text style={styles.dateTimeValue}>{formatDate(exitDate)}</Text>
                  </View>
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Exit Time</Text>
                  <View style={styles.readOnlyBox}>
                    <Text style={styles.dateTimeValue}>{formatTime(exitTime)}</Text>
                  </View>
                </View>
              </>
            )}

            {selectedRate === 'monthly' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Duration (months)</Text>
                <View style={styles.durationContainer}>
                  {[1, 2, 3].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.durationButton, durationMonths === m && styles.selectedDuration]}
                      onPress={() => setDurationMonths(m)}
                    >
                      <Text style={[styles.durationText, durationMonths === m && styles.selectedDurationText]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {selectedRate && (
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>Price: {calculatePrice()} baht</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.searchButton, !selectedRate && styles.disabledButton]}
          onPress={handleSearch}
          disabled={!selectedRate}
        >
          <Text style={styles.searchText}>Search</Text>
        </TouchableOpacity>

        {showPicker && (() => {
          let minDate;
          const today = new Date();
          const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

          if (pickerMode === 'entryDate') {
            if (selectedRate === 'daily' || selectedRate === 'monthly') {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              tomorrow.setHours(0, 0, 0, 0);
              minDate = tomorrow;
            } else {
              minDate = todayDateOnly;
            }
          } else if (pickerMode === 'entryTime') {
            if (entryDate.toDateString() === today.toDateString()) {
              minDate = today;
            } else {
              minDate = undefined;
            }
          } else {
            minDate = undefined;
          }
          
          return (
            <DateTimePicker
              value={
                pickerMode === 'entryDate' ? entryDate
                  : pickerMode === 'entryTime' ? entryTime
                  : new Date()
              }
              mode={pickerMode?.includes('Date') ? 'date' : 'time'}
              is24Hour={true}
              display="default"
              onChange={onChangeDateTime}
              minimumDate={minDate}
            />
          );
        })()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#B19CD8' 
  },
  scrollContainer: { 
    padding: 25, 
    paddingTop: 60,
    paddingBottom: 40,
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
    marginBottom: 40, 
    marginTop: 20 
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: 'white', 
    textAlign: 'center' 
  },
  section: { 
    marginBottom: 20 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 8 
  },
  ratesContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginHorizontal: 1
  },
  rateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedRateButton: { 
    backgroundColor: 'white', 
    borderColor: '#fff' 
  },
  rateLabel: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: 'white' 
  },
  selectedRateLabel: { 
    color: '#B19CD8' 
  },
  ratePrice: { 
    fontSize: 12, 
    color: 'rgba(255, 255, 255, 0.8)', 
    marginTop: 4 
  },
  selectedRatePrice: { 
    color: '#666' 
  },
  inputGroup: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 10,
    marginBottom: 20,
    shadowColor: 'black',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  dateTimeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#aaa',   
  },
  readOnlyBox: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ccc',   
  },
  dateTimeValue: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  durationContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 10 
  },
  durationButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 4,
  },
  selectedDuration: { 
    backgroundColor: '#B19CD8' 
  },
  durationText: { 
    fontSize: 16, 
    color: '#333', 
    fontWeight: 'bold' 
  },
  selectedDurationText: { 
    color: 'white' 
  },
  // ✅ สไตล์ใหม่สำหรับ Duration Selector (แบบง่าย)
  durationCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 25,
    marginHorizontal: 10,
    borderWidth: 2,
    borderColor: '#e8e8e8',
    alignItems: 'center',
  },
  durationLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  selectorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#B19CD8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  selectorButtonDisabled: {
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  durationDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  durationValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#B19CD8',
  },
  durationUnit: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  durationHelpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
  searchButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 30,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#B19CD8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchText: { 
    color: '#B19CD8', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  disabledButton: { 
    opacity: 0.5 
  },
  priceContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginHorizontal: 10,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: 'black',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B19CD8',
  },
});

export default BookParkingScreen;