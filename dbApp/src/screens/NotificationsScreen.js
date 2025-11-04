import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db } from '../firebaseConfig';
import { ref, onValue, update } from 'firebase/database';

const NotificationsScreen = ({ route, navigation }) => {
  const { username, userType} = route.params;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // ฟังก์ชันดึง notification
  const fetchNotifications = () => {
    try {
      // อ่านจาก root level และ filter ตาม username
      const notifRef = ref(db, "notifications");

      onValue(notifRef, (snapshot) => {
        const data = snapshot.val() || {};
        const notificationsArray = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(notif => {
            // กรองเฉพาะ notification ของ user นี้
            // ตรวจสอบทั้ง username โดยตรงและ visitor
            return notif.username === username || 
                   notif.visitorUsername === username;
          })
          .sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeB - timeA;
          });

        setNotifications(notificationsArray);
        const unread = notificationsArray.filter(notif => !notif.read).length;
        setUnreadCount(unread);
        setLoading(false);
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Unable to fetch notifications.");
      setLoading(false);
    }
  };

  // ฟังก์ชันทำเครื่องหมาย notification เป็นอ่านแล้ว
  const markAsRead = async (notificationId) => {
    try {
      const notifRef = ref(db, `notifications/${notificationId}`);
      await update(notifRef, { read: true });
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      Alert.alert("Error", "Failed to mark notification as read.");
    }
  };

  // ฟังก์ชันทำเครื่องหมาย notification ทั้งหมดเป็นอ่านแล้ว
  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(notif => !notif.read);
      
      for (const notif of unreadNotifications) {
        const notifRef = ref(db, `notifications/${notif.id}`);
        await update(notifRef, { read: true });
      }
      
      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      setUnreadCount(0);
      Alert.alert("Success", "All notifications marked as read.");
    } catch (error) {
      console.error("Error marking all as read:", error);
      Alert.alert("Error", "Failed to mark all notifications as read.");
    }
  };

  useEffect(() => { 
    fetchNotifications(); 
  }, [username, userType]);

  const handleBack = () => { navigation.goBack(); };
  const handleNotificationPress = (item) => { 
    if (!item.read) markAsRead(item.id); 
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return { date: "Unknown date", time: "" };
    try {
      const dateObj = new Date(timestamp);
      if (isNaN(dateObj.getTime())) return { date: "Invalid date", time: "" };
      
      const dateStr = dateObj.toLocaleDateString();
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      
      return { date: String(dateStr), time: String(timeStr) };
    } catch (error) {
      return { date: "Invalid date", time: "" };
    }
  };

  // ฟังก์ชันกำหนดสีตามประเภทผู้ใช้
  const getUserTypeColor = (type) => {
    switch (type) {
      case 'resident': return "#4CAF50";
      case 'visitor': return "#FF9800";
      default: return "#B19CD8";
    }
  };

  const renderItem = ({ item }) => {
    const { date, time } = formatTimestamp(item.timestamp);
    
    // กำหนดชื่อที่จะแสดงตามประเภทผู้ใช้
    let displayName = "";
    
    if (item.bookingType === "visitor") {
      // สำหรับ visitor ให้แสดง visitorUsername
      displayName = item.visitorUsername || item.visitorInfo?.visitorUsername || "Visitor";
    } else {
      // สำหรับ resident ให้แสดง username ตามปกติ
      displayName = item.username || "Resident";
    }
    
    return (
      <TouchableOpacity 
        style={[styles.notificationCard, !item.read && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationContent}>
            <View style={styles.cardHeader}>
              <View style={styles.alertHeader}>
                <Ionicons name="warning" size={20} color="#FF9800" />
                <Text style={styles.alertTitle}>{item.type === "Parking Slot Unavailable" ? "Parking Slot Unavailable" : "Parking Time Alert"}</Text>
              </View>
              <View style={[styles.userTypeBadge, { backgroundColor: getUserTypeColor(item.bookingType) }]}>
                <Text style={styles.userTypeText}>
                  {item.bookingType === "visitor" ? "Visitor" : "Resident"}
                </Text>
              </View>
            </View>
            
            <Text style={styles.message}>{item.message || ""}</Text>

            {item.slotId && (
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Ionicons name="person" size={14} color="#666" />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Username: </Text>
                    {displayName}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={14} color="#666" />
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Slot: </Text>
                    {item.slotId}
                    {item.floor && (
                      <>
                      <Text style={styles.detailLabel}>, Floor: </Text>
                      {item.floor}
                    </>
                  )}
                </Text>
              </View>
                
                {item.licensePlate && (
                  <View style={styles.detailRow}>
                    <Ionicons name="car" size={14} color="#666" />
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>License: </Text>
                      {item.licensePlate}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            <View style={styles.timeContainer}>
              <View style={styles.timeInfo}>
                <Ionicons name="calendar" size={12} color="#999" />
                <Text style={styles.dateText}>{date || ""}</Text>
              </View>
              <View style={styles.timeInfo}>
                <Ionicons name="time" size={12} color="#999" />
                <Text style={styles.timeText}>{time || ""}</Text>
              </View>
            </View>
          </View>
          <View style={styles.statusContainer}>
            {!item.read && <View style={styles.unreadDot} />}
            {item.read && <Ionicons name="checkmark-done" size={16} color="#4CAF50" />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#B19CD8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.headerSection}>
        <View style={styles.unreadInfo}>
          <Text style={styles.unreadCountText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
          <Text style={styles.noNotificationText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 60,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  placeholder: {
    width: 24,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  unreadInfo: {
    flex: 1,
  },
  unreadCountText: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: '600',
  },
  markAllButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#B19CD8',
    borderRadius: 20,
  },
  markAllText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 15,
  },
  notificationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationContent: {
    flex: 1,
    marginRight: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginLeft: 8,
  },
  userTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userTypeText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 11,
  },
  message: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  detailsContainer: {
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 6,
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#333',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  noNotificationText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});

export default NotificationsScreen;