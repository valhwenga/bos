export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen: string;
  department: string;
  role: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  type: 'text' | 'file' | 'image' | 'video' | 'audio';
  attachments?: MessageAttachment[];
  isRead: boolean;
  readAt?: string;
  isDelivered: boolean;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
  reactions?: MessageReaction[];
  replyTo?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'file' | 'image' | 'video' | 'audio' | 'link' | 'system';
  attachments?: MessageAttachment[];
  mentions?: string[];
  reactions?: MessageReaction[];
  replyTo?: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  readBy: MessageRead[];
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnail?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  emoji: string;
  createdAt: string;
}

export interface MessageRead {
  messageId: string;
  userId: string;
  userName: string;
  readAt: string;
}

export interface Conversation {
  id: string;
  name?: string;
  description?: string;
  type: 'direct' | 'group' | 'channel' | 'project';
  participantIds: string[];
  participants: ConversationParticipant[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: Message;
  lastActivity: string;
  isArchived: boolean;
  isPinned: boolean;
  settings: ConversationSettings;
  tags: string[];
}

export interface ConversationParticipant {
  userId: string;
  userName: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  joinedAt: string;
  lastSeen?: string;
  isOnline: boolean;
  isTyping: boolean;
  permissions: string[];
}

export interface ConversationSettings {
  isPublic: boolean;
  allowInvites: boolean;
  allowFileSharing: boolean;
  allowReactions: boolean;
  allowThreads: boolean;
  messageRetention: 'forever' | '30days' | '90days' | '1year';
  slowMode: number; // seconds between messages
}

export interface TeamWorkspace {
  id: string;
  name: string;
  description: string;
  type: 'department' | 'project' | 'cross-functional' | 'external';
  ownerId: string;
  ownerName: string;
  memberIds: string[];
  members: WorkspaceMember[];
  channels: string[]; // channel IDs
  createdAt: string;
  updatedAt: string;
  settings: WorkspaceSettings;
  integrations: WorkspaceIntegration[];
}

export interface WorkspaceMember {
  userId: string;
  userName: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  department?: string;
  joinedAt: string;
  lastActive: string;
  permissions: string[];
}

export interface WorkspaceSettings {
  isPublic: boolean;
  allowGuestAccess: boolean;
  allowExternalSharing: boolean;
  defaultChannelRetention: string;
  allowCustomChannels: boolean;
  requireApprovalForJoin: boolean;
}

export interface WorkspaceIntegration {
  id: string;
  type: 'calendar' | 'video' | 'document' | 'project' | 'email' | 'external';
  name: string;
  config: Record<string, any>;
  isActive: boolean;
  addedBy: string;
  addedByName: string;
  addedAt: string;
}

export interface VideoMeeting {
  id: string;
  title: string;
  description?: string;
  type: 'instant' | 'scheduled' | 'recurring';
  hostId: string;
  hostName: string;
  participantIds: string[];
  participants: MeetingParticipant[];
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  meetingUrl: string;
  meetingId: string;
  password?: string;
  settings: MeetingSettings;
  status: 'scheduled' | 'in-progress' | 'ended' | 'cancelled';
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingParticipant {
  userId: string;
  userName: string;
  role: 'host' | 'co-host' | 'participant' | 'guest';
  joinedAt?: string;
  leftAt?: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

export interface MeetingSettings {
  allowRecording: boolean;
  requirePassword: boolean;
  waitingRoom: boolean;
  allowScreenShare: boolean;
  allowChat: boolean;
  maxParticipants: number;
}

export interface TeamCalendar {
  id: string;
  name: string;
  description?: string;
  type: 'personal' | 'team' | 'project' | 'company';
  ownerId: string;
  ownerName: string;
  memberIds: string[];
  sharedWith: string[];
  events: CalendarEvent[];
  createdAt: string;
  updatedAt: string;
  settings: CalendarSettings;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  type: 'meeting' | 'task' | 'reminder' | 'deadline' | 'holiday' | 'personal';
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location?: string;
  attendeeIds: string[];
  attendees: EventAttendee[];
  organizerId: string;
  organizerName: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  reminders: EventReminder[];
  attachments?: string[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface EventAttendee {
  userId: string;
  userName: string;
  email: string;
  status: 'accepted' | 'declined' | 'tentative' | 'pending';
  responseAt?: string;
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
}

export interface EventReminder {
  id: string;
  eventId: string;
  type: 'email' | 'notification' | 'popup';
  minutesBefore: number;
  isEnabled: boolean;
}

export interface CalendarSettings {
  isPublic: boolean;
  allowBooking: boolean;
  defaultView: 'day' | 'week' | 'month';
  workingHours: {
    start: string;
    end: string;
    days: number[];
  };
  timeZone: string;
}

export interface Notification {
  id: string;
  userId: string;
  userName: string;
  type: 'message' | 'mention' | 'meeting' | 'calendar' | 'task' | 'system' | 'approval';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  expiresAt?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'button' | 'link';
  url?: string;
  action?: string;
  style: 'primary' | 'secondary' | 'danger';
}

const MESSAGES_KEY = 'communication_messages';
const CONVERSATIONS_KEY = 'communication_conversations';
const WORKSPACES_KEY = 'communication_workspaces';
const MEETINGS_KEY = 'communication_meetings';
const CALENDARS_KEY = 'communication_calendars';
const NOTIFICATIONS_KEY = 'communication_notifications';
const DIRECT_MESSAGES_KEY = 'communication_direct_messages';
const USERS_KEY = 'communication_users';

export const CommunicationStore = {
  // User Management
  getUsers(): User[] {
    try {
      const users = localStorage.getItem(USERS_KEY);
      return users ? JSON.parse(users) : [];
    } catch {
      return [];
    }
  },

  createUser(user: Omit<User, 'lastSeen'>): User {
    const newUser: User = {
      ...user,
      lastSeen: new Date().toISOString(),
    };

    const users = this.getUsers();
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    return newUser;
  },

  updateUserStatus(userId: string, status: User['status']): void {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    
    if (user) {
      user.status = status;
      user.lastSeen = new Date().toISOString();
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  },

  // Direct Message Management
  getDirectMessages(userId?: string): DirectMessage[] {
    try {
      const messages = localStorage.getItem(DIRECT_MESSAGES_KEY);
      const allMessages = messages ? JSON.parse(messages) : [];
      
      if (userId) {
        return allMessages.filter((m: DirectMessage) => 
          (m.senderId === userId || m.receiverId === userId)
        );
      }
      
      return allMessages;
    } catch {
      return [];
    }
  },

  getDirectMessageConversation(userId1: string, userId2: string): DirectMessage[] {
    const messages = this.getDirectMessages();
    return messages.filter(m => 
      (m.senderId === userId1 && m.receiverId === userId2) ||
      (m.senderId === userId2 && m.receiverId === userId1)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  sendDirectMessage(senderId: string, senderName: string, receiverId: string, receiverName: string, content: string): DirectMessage {
    const newMessage: DirectMessage = {
      id: `dm_${Date.now()}`,
      senderId,
      senderName,
      receiverId,
      receiverName,
      content,
      type: 'text',
      isRead: false,
      isDelivered: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const messages = this.getDirectMessages();
    messages.push(newMessage);
    localStorage.setItem(DIRECT_MESSAGES_KEY, JSON.stringify(messages));

    // Mark as delivered
    this.markMessageAsDelivered(newMessage.id);

    // Create notification for receiver
    this.createNotification({
      userId: receiverId,
      userName: receiverName,
      type: 'message',
      title: `New message from ${senderName}`,
      message: content,
      data: { messageId: newMessage.id, senderId },
      priority: 'medium',
    });

    // Trigger event
    window.dispatchEvent(new CustomEvent('direct-message-sent', { detail: newMessage }));

    return newMessage;
  },

  markMessageAsRead(messageId: string): boolean {
    const messages = JSON.parse(localStorage.getItem(DIRECT_MESSAGES_KEY) || '[]');
    const message = messages.find((m: DirectMessage) => m.id === messageId);
    
    if (!message || message.isRead) return false;

    message.isRead = true;
    message.readAt = new Date().toISOString();
    localStorage.setItem(DIRECT_MESSAGES_KEY, JSON.stringify(messages));

    // Trigger event
    window.dispatchEvent(new CustomEvent('direct-message-read', { detail: { messageId } }));

    return true;
  },

  markMessageAsDelivered(messageId: string): boolean {
    const messages = JSON.parse(localStorage.getItem(DIRECT_MESSAGES_KEY) || '[]');
    const message = messages.find((m: DirectMessage) => m.id === messageId);
    
    if (!message || message.isDelivered) return false;

    message.isDelivered = true;
    message.deliveredAt = new Date().toISOString();
    localStorage.setItem(DIRECT_MESSAGES_KEY, JSON.stringify(messages));

    return true;
  },

  getUnreadMessageCount(userId: string): number {
    const messages = this.getDirectMessages(userId);
    return messages.filter(m => !m.isRead && m.receiverId === userId).length;
  },

  getRecentConversations(userId: string): Array<{user: User, lastMessage: DirectMessage, unreadCount: number}> {
    const messages = this.getDirectMessages(userId);
    const users = this.getUsers();
    const conversationMap = new Map<string, {user: User, lastMessage: DirectMessage, unreadCount: number}>();

    messages.forEach(message => {
      const otherUserId = message.senderId === userId ? message.receiverId : message.senderId;
      const otherUser = users.find(u => u.id === otherUserId);
      
      if (otherUser) {
        const existing = conversationMap.get(otherUserId);
        const unreadCount = message.receiverId === userId && !message.isRead ? 1 : 0;
        
        if (!existing || new Date(message.createdAt) > new Date(existing.lastMessage.createdAt)) {
          conversationMap.set(otherUserId, {
            user: otherUser,
            lastMessage: message,
            unreadCount: existing ? existing.unreadCount + unreadCount : unreadCount
          });
        } else if (message.receiverId === userId && !message.isRead) {
          existing.unreadCount++;
        }
      }
    });

    return Array.from(conversationMap.values()).sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
  },
  getMessages(conversationId?: string): Message[] {
    try {
      const messages = localStorage.getItem(MESSAGES_KEY);
      const allMessages = messages ? JSON.parse(messages) : [];
      
      if (conversationId) {
        return allMessages.filter((m: Message) => m.conversationId === conversationId && !m.isDeleted);
      }
      
      return allMessages.filter((m: Message) => !m.isDeleted);
    } catch {
      return [];
    }
  },

  createMessage(message: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'isEdited' | 'isDeleted' | 'readBy'>): Message {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEdited: false,
      isDeleted: false,
      readBy: [],
    };

    const messages = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    messages.push(newMessage);
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));

    // Update conversation last message
    this.updateConversation(message.conversationId, {
      lastMessage: newMessage,
      lastActivity: newMessage.createdAt,
    });

    // Trigger event
    window.dispatchEvent(new CustomEvent('message-created', { detail: newMessage }));

    return newMessage;
  },

  updateMessage(id: string, updates: Partial<Message>): Message | null {
    const messages = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    const index = messages.findIndex((m: Message) => m.id === id);
    
    if (index === -1) return null;

    messages[index] = { 
      ...messages[index], 
      ...updates,
      updatedAt: new Date().toISOString(),
      isEdited: true,
      editedAt: new Date().toISOString(),
    };
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));

    // Trigger event
    window.dispatchEvent(new CustomEvent('message-updated', { detail: messages[index] }));

    return messages[index];
  },

  deleteMessage(id: string, userId: string): boolean {
    const messages = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    const message = messages.find((m: Message) => m.id === id);
    
    if (!message || message.senderId !== userId) return false;

    message.isDeleted = true;
    message.deletedAt = new Date().toISOString();
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));

    // Trigger event
    window.dispatchEvent(new CustomEvent('message-deleted', { detail: { id } }));

    return true;
  },

  // Conversation Management
  getConversations(): Conversation[] {
    try {
      const conversations = localStorage.getItem(CONVERSATIONS_KEY);
      return conversations ? JSON.parse(conversations) : [];
    } catch {
      return [];
    }
  },

  createConversation(conversation: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt' | 'lastActivity'>): Conversation {
    const newConversation: Conversation = {
      ...conversation,
      id: `conv_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    const conversations = this.getConversations();
    conversations.push(newConversation);
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));

    // Trigger event
    window.dispatchEvent(new CustomEvent('conversation-created', { detail: newConversation }));

    return newConversation;
  },

  updateConversation(id: string, updates: Partial<Conversation>): Conversation | null {
    const conversations = this.getConversations();
    const index = conversations.findIndex(c => c.id === id);
    
    if (index === -1) return null;

    conversations[index] = { 
      ...conversations[index], 
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));

    // Trigger event
    window.dispatchEvent(new CustomEvent('conversation-updated', { detail: conversations[index] }));

    return conversations[index];
  },

  // Workspace Management
  getWorkspaces(): TeamWorkspace[] {
    try {
      const workspaces = localStorage.getItem(WORKSPACES_KEY);
      return workspaces ? JSON.parse(workspaces) : [];
    } catch {
      return [];
    }
  },

  createWorkspace(workspace: Omit<TeamWorkspace, 'id' | 'createdAt' | 'updatedAt'>): TeamWorkspace {
    const newWorkspace: TeamWorkspace = {
      ...workspace,
      id: `ws_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const workspaces = this.getWorkspaces();
    workspaces.push(newWorkspace);
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));

    // Create default channel
    this.createConversation({
      name: 'general',
      description: 'General discussion',
      type: 'channel',
      participantIds: workspace.memberIds,
      participants: workspace.members.map(m => ({
        userId: m.userId,
        userName: m.userName,
        role: m.role === 'owner' ? 'owner' : 'member',
        joinedAt: new Date().toISOString(),
        isOnline: false,
        isTyping: false,
        permissions: ['read', 'write'],
      })),
      createdBy: workspace.ownerId,
      createdByName: workspace.ownerName,
      isArchived: false,
      isPinned: false,
      settings: {
        isPublic: true,
        allowInvites: true,
        allowFileSharing: true,
        allowReactions: true,
        allowThreads: true,
        messageRetention: 'forever',
        slowMode: 0,
      },
      tags: [],
    });

    // Trigger event
    window.dispatchEvent(new CustomEvent('workspace-created', { detail: newWorkspace }));

    return newWorkspace;
  },

  // Meeting Management
  getMeetings(): VideoMeeting[] {
    try {
      const meetings = localStorage.getItem(MEETINGS_KEY);
      return meetings ? JSON.parse(meetings) : [];
    } catch {
      return [];
    }
  },

  createMeeting(meeting: Omit<VideoMeeting, 'id' | 'createdAt' | 'updatedAt' | 'status'>): VideoMeeting {
    const newMeeting: VideoMeeting = {
      ...meeting,
      id: `meeting_${Date.now()}`,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const meetings = this.getMeetings();
    meetings.push(newMeeting);
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));

    // Create calendar event for scheduled meeting
    if (meeting.scheduledStart && meeting.scheduledEnd) {
      this.createCalendarEvent({
        calendarId: 'personal',
        title: meeting.title,
        description: meeting.description,
        type: 'meeting',
        startTime: meeting.scheduledStart,
        endTime: meeting.scheduledEnd,
        attendeeIds: meeting.participantIds,
        attendees: meeting.participants.map(p => ({
          userId: p.userId,
          userName: p.userName,
          email: `${p.userName.toLowerCase().replace(' ', '.')}@company.com`,
          status: 'pending',
        })),
        organizerId: meeting.hostId,
        organizerName: meeting.hostName,
        isRecurring: false,
        reminders: [
          {
            id: `rem_${Date.now()}`,
            eventId: '',
            type: 'notification',
            minutesBefore: 15,
            isEnabled: true,
          },
        ],
        status: 'confirmed',
      });
    }

    // Trigger event
    window.dispatchEvent(new CustomEvent('meeting-created', { detail: newMeeting }));

    return newMeeting;
  },

  // Calendar Management
  getCalendars(): TeamCalendar[] {
    try {
      const calendars = localStorage.getItem(CALENDARS_KEY);
      return calendars ? JSON.parse(calendars) : [];
    } catch {
      return [];
    }
  },

  createCalendarCalendar(calendar: Omit<TeamCalendar, 'id' | 'createdAt' | 'updatedAt' | 'events'>): TeamCalendar {
    const newCalendar: TeamCalendar = {
      ...calendar,
      id: `cal_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [],
    };

    const calendars = this.getCalendars();
    calendars.push(newCalendar);
    localStorage.setItem(CALENDARS_KEY, JSON.stringify(calendars));

    // Trigger event
    window.dispatchEvent(new CustomEvent('calendar-created', { detail: newCalendar }));

    return newCalendar;
  },

  createCalendarEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): CalendarEvent {
    const newEvent: CalendarEvent = {
      ...event,
      id: `event_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const calendars = this.getCalendars();
    const calendarIndex = calendars.findIndex(c => c.id === event.calendarId);
    
    if (calendarIndex !== -1) {
      calendars[calendarIndex].events.push(newEvent);
      calendars[calendarIndex].updatedAt = new Date().toISOString();
      localStorage.setItem(CALENDARS_KEY, JSON.stringify(calendars));

      // Trigger event
      window.dispatchEvent(new CustomEvent('calendar-event-created', { detail: newEvent }));
    }

    return newEvent;
  },

  // Notification Management
  getNotifications(userId?: string): Notification[] {
    try {
      const notifications = localStorage.getItem(NOTIFICATIONS_KEY);
      const allNotifications = notifications ? JSON.parse(notifications) : [];
      
      if (userId) {
        return allNotifications.filter((n: Notification) => n.userId === userId);
      }
      
      return allNotifications;
    } catch {
      return [];
    }
  },

  createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Notification {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    const notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
    notifications.push(newNotification);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));

    // Trigger event
    window.dispatchEvent(new CustomEvent('notification-created', { detail: newNotification }));

    return newNotification;
  },

  markNotificationRead(id: string): boolean {
    const notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
    const notification = notifications.find((n: Notification) => n.id === id);
    
    if (!notification) return false;

    notification.isRead = true;
    notification.readAt = new Date().toISOString();
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));

    // Trigger event
    window.dispatchEvent(new CustomEvent('notification-read', { detail: { id } }));

    return true;
  },

  // Analytics
  getCommunicationAnalytics(userId?: string): {
    totalMessages: number;
    totalConversations: number;
    totalMeetings: number;
    upcomingMeetings: number;
    unreadNotifications: number;
    activeWorkspaces: number;
    messagesByType: Record<string, number>;
    meetingsByStatus: Record<string, number>;
    recentActivity: any[];
  } {
    const messages = this.getMessages();
    const conversations = this.getConversations();
    const meetings = this.getMeetings();
    const notifications = this.getNotifications(userId);
    const workspaces = this.getWorkspaces();

    const userMessages = userId ? messages.filter(m => m.senderId === userId) : messages;
    const userConversations = userId ? conversations.filter(c => c.participantIds.includes(userId)) : conversations;

    return {
      totalMessages: userMessages.length,
      totalConversations: userConversations.length,
      totalMeetings: meetings.length,
      upcomingMeetings: meetings.filter(m => m.status === 'scheduled' && new Date(m.scheduledStart || '') > new Date()).length,
      unreadNotifications: notifications.filter(n => !n.isRead).length,
      activeWorkspaces: workspaces.length,
      messagesByType: userMessages.reduce((acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      meetingsByStatus: meetings.reduce((acc, meeting) => {
        acc[meeting.status] = (acc[meeting.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentActivity: [], // Would combine recent messages, meetings, etc.
    };
  },

  // Initialize default data
  initializeDefaultData(): void {
    const existingConversations = this.getConversations();
    const existingWorkspaces = this.getWorkspaces();
    const existingCalendars = this.getCalendars();
    const existingUsers = this.getUsers();

    // Create sample users if none exist
    if (existingUsers.length === 0) {
      this.createUser({
        id: 'user1',
        name: 'Alice Johnson',
        email: 'alice@company.com',
        status: 'online',
        department: 'Engineering',
        role: 'Senior Developer',
      });

      this.createUser({
        id: 'user2',
        name: 'Bob Smith',
        email: 'bob@company.com',
        status: 'online',
        department: 'Design',
        role: 'UI/UX Designer',
      });

      this.createUser({
        id: 'user3',
        name: 'Carol Williams',
        email: 'carol@company.com',
        status: 'away',
        department: 'Marketing',
        role: 'Marketing Manager',
      });

      this.createUser({
        id: 'user4',
        name: 'David Brown',
        email: 'david@company.com',
        status: 'offline',
        department: 'Sales',
        role: 'Sales Representative',
      });

      this.createUser({
        id: 'user5',
        name: 'Eva Davis',
        email: 'eva@company.com',
        status: 'online',
        department: 'HR',
        role: 'HR Manager',
      });
    }

    // Create default workspace if none exists
    if (existingWorkspaces.length === 0) {
      this.createWorkspace({
        name: 'General Workspace',
        description: 'Main company workspace for team collaboration',
        type: 'department',
        ownerId: 'system',
        ownerName: 'System',
        memberIds: ['system'],
        members: [{
          userId: 'system',
          userName: 'System',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          permissions: ['admin', 'create', 'edit', 'delete'],
        }],
        channels: [],
        settings: {
          isPublic: true,
          allowGuestAccess: false,
          allowExternalSharing: false,
          defaultChannelRetention: 'forever',
          allowCustomChannels: true,
          requireApprovalForJoin: false,
        },
        integrations: [],
      });
    }

    // Create personal calendar if none exists
    if (existingCalendars.length === 0) {
      this.createCalendarCalendar({
        name: 'Personal Calendar',
        type: 'personal',
        ownerId: 'system',
        ownerName: 'System',
        memberIds: ['system'],
        sharedWith: [],
        settings: {
          isPublic: false,
          allowBooking: true,
          defaultView: 'week',
          workingHours: {
            start: '09:00',
            end: '17:00',
            days: [1, 2, 3, 4, 5],
          },
          timeZone: 'UTC',
        },
      });
    }

    // Create sample conversation if none exists
    if (existingConversations.length === 0) {
      const conversation = this.createConversation({
        name: 'General',
        description: 'General team discussion',
        type: 'channel',
        participantIds: ['system'],
        participants: [{
          userId: 'system',
          userName: 'System',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          isOnline: true,
          isTyping: false,
          permissions: ['read', 'write', 'admin'],
        }],
        createdBy: 'system',
        createdByName: 'System',
        isArchived: false,
        isPinned: false,
        settings: {
          isPublic: true,
          allowInvites: true,
          allowFileSharing: true,
          allowReactions: true,
          allowThreads: true,
          messageRetention: 'forever',
          slowMode: 0,
        },
        tags: ['general', 'team'],
      });

      // Add welcome message
      this.createMessage({
        conversationId: conversation.id,
        senderId: 'system',
        senderName: 'System',
        content: 'Welcome to the team collaboration system! This is your general channel for team discussions.',
        type: 'text',
        mentions: [],
        replyTo: undefined,
      });
    }
  },
};
