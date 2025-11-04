import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView,Platform,Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import Ionicons from 'react-native-vector-icons/Ionicons';

const InviteLinkScreen = ({ route, navigation }) => {
    const { username, bookingData } = route.params;
    const [inviteLink, setInviteLink] = useState('');

    useEffect(() => {
        generateInviteLink();
    }, []);

    const generateInviteLink = () => {
        const sessionId = `${bookingData.id}-${Date.now()}`;
        
        // ใช้ Linking.createURL เพื่อสร้าง deep link ที่ถูกต้อง
        const link = Linking.createURL(`visitor/${sessionId}`);
        setInviteLink(link);
    };

    const handleBack = () => {
        navigation.goBack();
    };

    // ฟังก์ชัน shareLink ใช้ Share API 
    const shareLink = async () => {
        if (!inviteLink) return;
        try {
            await Share.share({
                message: `You have received a link to access the parking service: ${inviteLink}`,
                url: inviteLink,
                title: 'Parking Access Link'
            });
        } catch (error) {
            Alert.alert('Error', 'Cannot share the link.');
        }
    };

    const copyLink = async () => {
        if (!inviteLink) return;
        await Clipboard.setStringAsync(inviteLink);
        Alert.alert('Copied!', 'The invite link has been copied to clipboard.');
    };

    const regenerateLink = () => {
        Alert.alert(
            "Regenerate Link",
            "Are you sure you want to generate a new invite link? The previous link will become invalid.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Generate New", 
                    onPress: () => {
                        generateInviteLink();
                        Alert.alert("Success", "New invite link generated!");
                    }
                }
            ]
        );
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                
                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Visitor Invite Link</Text>
                    <Text style={styles.subtitle}>Share parking access with your visitor</Text>
                </View>

                {/* Invite Link Card */}
                <View style={styles.infoCard}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="link" size={24} color="#FF9800" />
                        <Text style={styles.cardTitle}>Invite Link</Text>
                    </View>
                    
                    <View style={styles.linkContainer}>
                        <Text style={styles.linkText} numberOfLines={3}>
                            {inviteLink}
                        </Text>
                    </View>

                    <View style={styles.linkActions}>
                        <TouchableOpacity style={styles.shareButton} onPress={shareLink}>
                            <Ionicons name="share" size={20} color="white" />
                            <Text style={styles.shareButtonText}>Share Link</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.shareButton, {backgroundColor: '#6C757D'}]} onPress={copyLink}>
                            <Ionicons name="copy" size={20} color="white" />
                            <Text style={styles.shareButtonText}>Copy Link</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.regenerateButton} onPress={regenerateLink}>
                        <Ionicons name="refresh" size={18} color="#666" />
                        <Text style={styles.regenerateButtonText}>Generate New Link</Text>
                    </TouchableOpacity>
                </View>

                {/* เพิ่มคำแนะนำการใช้งาน */}
                <View style={styles.instructionsCard}>
                    <Text style={styles.instructionTitle}>How to use:</Text>
                    <Text style={styles.instructionText}>1. Tap "Share Link" to send via messaging apps</Text>
                    <Text style={styles.instructionText}>2. Tap "Copy Link" to copy and paste anywhere</Text>
                    <Text style={styles.instructionText}>3. Visitor clicks the link to access parking control</Text>
                </View>
            </ScrollView>
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
    linkContainer: {
        backgroundColor: '#F7FAFC',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    linkText: {
        fontSize: 12,
        color: '#2D3748',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 18,
    },
    linkActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 15,
    },
    shareButton: {
        backgroundColor: '#2196F3',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        flex: 1,
    },
    shareButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    regenerateButton: {
        backgroundColor: '#F8F9FA',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    regenerateButtonText: {
        color: '#666',
        fontWeight: '500',
        fontSize: 14,
    },
    instructionsCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        width: '100%',
    },
    instructionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 10,
    },
    instructionText: {
        fontSize: 14,
        color: '#4A5568',
        marginBottom: 8,
        lineHeight: 20,
    },
});

export default InviteLinkScreen;