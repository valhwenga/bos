import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CommunicationStore, Conversation, Message, VideoMeeting, TeamCalendar, Notification, User, DirectMessage } from '@/lib/communicationStore';
import { SecurityStore } from '@/lib/securityStore';
import {
  MessageSquare,
  Users,
  Video,
  Calendar,
  Bell,
  Search,
  Send,
  Phone,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Share,
  Settings,
  Plus,
  Clock,
  TrendingUp,
  BarChart3,
  UserPlus,
  Hash,
  Pin,
  Archive,
  Star,
  Paperclip,
  Smile,
  MoreVertical,
  Check,
  CheckCheck,
  Eye,
  EyeOff,
  Circle,
  User as UserIcon,
  UserCheck,
  UserX
} from 'lucide-react';

const CommunicationDashboard: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meetings, setMeetings] = useState<VideoMeeting[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [analytics, setAnalytics] = useState(CommunicationStore.getCommunicationAnalytics());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('messages');
  
  // Direct messaging state
  const [users, setUsers] = useState<User[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);
  const [recentConversations, setRecentConversations] = useState<Array<{user: User, lastMessage: DirectMessage, unreadCount: number}>>([]);
  const [directMessageInput, setDirectMessageInput] = useState('');

  useEffect(() => {
    // Load data
    setConversations(CommunicationStore.getConversations());
    setMessages(CommunicationStore.getMessages());
    setMeetings(CommunicationStore.getMeetings());
    setNotifications(CommunicationStore.getNotifications());
    setAnalytics(CommunicationStore.getCommunicationAnalytics());
    setCurrentUser(SecurityStore.getCurrentSession()?.user);
    
    // Load direct messaging data
    setUsers(CommunicationStore.getUsers());
    setDirectMessages(CommunicationStore.getDirectMessages());
    if (currentUser) {
      setRecentConversations(CommunicationStore.getRecentConversations(currentUser.id));
    }

    // Initialize default data
    CommunicationStore.initializeDefaultData();

    // Set up event listeners
    const handleMessageChange = () => {
      setMessages(CommunicationStore.getMessages());
      setConversations(CommunicationStore.getConversations());
      setAnalytics(CommunicationStore.getCommunicationAnalytics());
    };

    const handleDirectMessageChange = () => {
      setDirectMessages(CommunicationStore.getDirectMessages());
      if (currentUser) {
        setRecentConversations(CommunicationStore.getRecentConversations(currentUser.id));
      }
    };

    const handleMeetingChange = () => {
      setMeetings(CommunicationStore.getMeetings());
      setAnalytics(CommunicationStore.getCommunicationAnalytics());
    };

    const handleNotificationChange = () => {
      setNotifications(CommunicationStore.getNotifications());
      setAnalytics(CommunicationStore.getCommunicationAnalytics());
    };

    window.addEventListener('message-created', handleMessageChange as EventListener);
    window.addEventListener('conversation-updated', handleMessageChange as EventListener);
    window.addEventListener('direct-message-sent', handleDirectMessageChange as EventListener);
    window.addEventListener('direct-message-read', handleDirectMessageChange as EventListener);
    window.addEventListener('meeting-created', handleMeetingChange as EventListener);
    window.addEventListener('notification-created', handleNotificationChange as EventListener);

    return () => {
      window.removeEventListener('message-created', handleMessageChange as EventListener);
      window.removeEventListener('conversation-updated', handleMessageChange as EventListener);
      window.removeEventListener('direct-message-sent', handleDirectMessageChange as EventListener);
      window.removeEventListener('direct-message-read', handleDirectMessageChange as EventListener);
      window.removeEventListener('meeting-created', handleMeetingChange as EventListener);
      window.removeEventListener('notification-created', handleNotificationChange as EventListener);
    };
  }, []);

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'direct': return <Users className="w-4 h-4" />;
      case 'group': return <Users className="w-4 h-4" />;
      case 'channel': return <Hash className="w-4 h-4" />;
      case 'project': return <Star className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500 text-white';
      case 'in-progress': return 'bg-green-500 text-white';
      case 'ended': return 'bg-gray-500 text-white';
      case 'cancelled': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message': return 'bg-blue-500 text-white';
      case 'mention': return 'bg-purple-500 text-white';
      case 'meeting': return 'bg-green-500 text-white';
      case 'urgent': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? 'now' : `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversation) return;

    const newMessage = CommunicationStore.createMessage({
      conversationId: selectedConversation.id,
      senderId: currentUser?.id || 'user',
      senderName: currentUser?.name || 'User',
      content: messageInput,
      type: 'text',
      mentions: [],
      replyTo: undefined,
    });

    setMessageInput('');
    console.log('Message sent:', newMessage);
  };

  const handleStartMeeting = () => {
    const meeting = CommunicationStore.createMeeting({
      title: 'Instant Meeting',
      type: 'instant',
      hostId: currentUser?.id || 'user',
      hostName: currentUser?.name || 'User',
      participantIds: [currentUser?.id || 'user'],
      participants: [{
        userId: currentUser?.id || 'user',
        userName: currentUser?.name || 'User',
        role: 'host',
        isMuted: false,
        isVideoOn: true,
        isScreenSharing: false,
      }],
      meetingUrl: `https://meet.company.com/${Date.now()}`,
      meetingId: Date.now().toString(),
      settings: {
        allowRecording: true,
        requirePassword: false,
        waitingRoom: false,
        allowScreenShare: true,
        allowChat: true,
        maxParticipants: 50,
      },
    });

    console.log('Meeting started:', meeting);
  };

  // Direct messaging functions
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    // Mark all messages from this user as read
    const userMessages = directMessages.filter(m => 
      m.senderId === user.id && m.receiverId === currentUser?.id && !m.isRead
    );
    userMessages.forEach(m => CommunicationStore.markMessageAsRead(m.id));
  };

  const handleSendDirectMessage = () => {
    if (!directMessageInput.trim() || !selectedUser || !currentUser) return;

    const message = CommunicationStore.sendDirectMessage(
      currentUser.id,
      currentUser.name,
      selectedUser.id,
      selectedUser.name,
      directMessageInput
    );

    setDirectMessageInput('');
    console.log('Direct message sent:', message);
  };

  const handleOpenNewMessageDialog = () => {
    setShowNewMessageDialog(true);
  };

  const handleStartConversation = (user: User) => {
    setSelectedUser(user);
    setShowNewMessageDialog(false);
    setActiveTab('messages');
  };

  const getUserStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getUserStatusText = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'away': return 'Away';
      case 'busy': return 'Busy';
      case 'offline': return 'Offline';
      default: return 'Offline';
    }
  };

  const handleMarkNotificationRead = (notificationId: string) => {
    CommunicationStore.markNotificationRead(notificationId);
    setNotifications(CommunicationStore.getNotifications());
  };

  const conversationMessages = selectedConversation 
    ? messages.filter(m => m.conversationId === selectedConversation.id)
    : [];

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const upcomingMeetings = meetings.filter(m => 
    m.status === 'scheduled' && 
    new Date(m.scheduledStart || '') > new Date()
  );

  // Get direct messages for selected user
  const userDirectMessages = selectedUser && currentUser
    ? CommunicationStore.getDirectMessageConversation(currentUser.id, selectedUser.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages</p>
                <p className="text-2xl font-bold">{analytics.totalMessages}</p>
                <p className="text-xs text-blue-600">{analytics.totalConversations} conversations</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Direct Messages</p>
                <p className="text-2xl font-bold">{recentConversations.reduce((sum, conv) => sum + conv.unreadCount, 0)}</p>
                <p className="text-xs text-green-600">{users.length} users</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Meetings</p>
                <p className="text-2xl font-bold">{analytics.totalMeetings}</p>
                <p className="text-xs text-green-600">{upcomingMeetings.length} upcoming</p>
              </div>
              <Video className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Notifications</p>
                <p className="text-2xl font-bold">{unreadNotifications.length}</p>
                <p className="text-xs text-orange-600">unread</p>
              </div>
              <Bell className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="direct">Direct Chat</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Conversations List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Conversations
                  </CardTitle>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    New
                  </Button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                        selectedConversation?.id === conversation.id ? 'bg-gray-100' : ''
                      }`}
                      onClick={() => setSelectedConversation(conversation)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getConversationIcon(conversation.type)}
                        <span className="font-medium text-sm">{conversation.name || 'Direct Message'}</span>
                        {conversation.isPinned && (
                          <Pin className="w-3 h-3 text-gray-500" />
                        )}
                      </div>
                      
                      {conversation.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conversation.lastMessage.senderName}: {conversation.lastMessage.content}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatTime(conversation.lastActivity)}
                        </span>
                        {conversation.participants.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {conversation.participants.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="lg:col-span-2">
              <CardHeader>
                {selectedConversation ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getConversationIcon(selectedConversation.type)}
                      <CardTitle className="text-lg">{selectedConversation.name}</CardTitle>
                      <Badge variant="outline">{selectedConversation.participants.length} members</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </Button>
                      <Button size="sm" variant="outline">
                        <Video className="w-4 h-4 mr-1" />
                        Video
                      </Button>
                      <Button size="sm" variant="outline">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <CardTitle>Select a conversation</CardTitle>
                )}
              </CardHeader>
              
              {selectedConversation ? (
                <>
                  <CardContent className="h-96 overflow-y-auto">
                    <div className="space-y-4">
                      {conversationMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              message.senderId === currentUser?.id
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs opacity-70">
                                {formatTime(message.createdAt)}
                              </span>
                              {message.senderId === currentUser?.id && (
                                <CheckCheck className="w-3 h-3 opacity-70" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <Input
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1"
                      />
                      <Button size="sm" variant="outline">
                        <Smile className="w-4 h-4" />
                      </Button>
                      <Button size="sm" onClick={handleSendMessage}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <CardContent>
                  <div className="flex items-center justify-center h-96 text-muted-foreground">
                    Select a conversation to start messaging
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Video Meetings
                </CardTitle>
                <div className="flex gap-2">
                  <Button onClick={handleStartMeeting}>
                    <Video className="w-4 h-4 mr-2" />
                    Start Meeting
                  </Button>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        <span className="font-medium">{meeting.title}</span>
                        <Badge className={getStatusColor(meeting.status)}>
                          {meeting.status}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {meeting.scheduledStart && formatTime(meeting.scheduledStart)}
                      </span>
                    </div>
                    
                    {meeting.description && (
                      <p className="text-sm text-muted-foreground mb-3">{meeting.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Host: {meeting.hostName}</span>
                        <span>{meeting.participants.length} participants</span>
                        {meeting.scheduledStart && (
                          <span>{new Date(meeting.scheduledStart).toLocaleDateString()}</span>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {meeting.status === 'scheduled' && (
                          <Button size="sm">Join</Button>
                        )}
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Direct Chat Tab */}
        <TabsContent value="direct" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Users List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Direct Messages
                  </CardTitle>
                  <Button size="sm" onClick={handleOpenNewMessageDialog}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    New Chat
                  </Button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {/* Recent Conversations */}
                  {recentConversations.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recent</h3>
                      {recentConversations.map((conv) => (
                        <div
                          key={conv.user.id}
                          className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                            selectedUser?.id === conv.user.id ? 'bg-gray-100' : ''
                          }`}
                          onClick={() => handleSelectUser(conv.user)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className="relative">
                              <div className={`w-2 h-2 rounded-full ${getUserStatusColor(conv.user.status)}`} />
                              {conv.unreadCount > 0 && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                                  {conv.unreadCount}
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-sm">{conv.user.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {conv.user.department}
                            </Badge>
                          </div>
                          
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.lastMessage.content}
                          </p>
                          
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(conv.lastMessage.createdAt)}
                            </span>
                            {conv.lastMessage.isRead ? (
                              <CheckCheck className="w-3 h-3 text-blue-500" />
                            ) : (
                              <Check className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* All Users */}
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 mt-4">All Users</h3>
                  {users
                    .filter(user => 
                      searchQuery === '' || 
                      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      user.department.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .filter(user => !recentConversations.find(conv => conv.user.id === user.id))
                    .map((user) => (
                      <div
                        key={user.id}
                        className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 ${
                          selectedUser?.id === user.id ? 'bg-gray-100' : ''
                        }`}
                        onClick={() => handleSelectUser(user)}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getUserStatusColor(user.status)}`} />
                          <span className="font-medium text-sm">{user.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.department}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            {getUserStatusText(user.status)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {user.role}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="lg:col-span-2">
              <CardHeader>
                {selectedUser ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getUserStatusColor(selectedUser.status)}`} />
                      <CardTitle className="text-lg">{selectedUser.name}</CardTitle>
                      <Badge variant="outline">{selectedUser.department}</Badge>
                      <Badge variant="outline">{selectedUser.role}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </Button>
                      <Button size="sm" variant="outline">
                        <Video className="w-4 h-4 mr-1" />
                        Video
                      </Button>
                      <Button size="sm" variant="outline">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <CardTitle>Select a user to start messaging</CardTitle>
                )}
              </CardHeader>
              
              {selectedUser ? (
                <>
                  <CardContent className="h-96 overflow-y-auto">
                    <div className="space-y-4">
                      {userDirectMessages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        userDirectMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                message.senderId === currentUser?.id
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              <p className="text-sm">{message.content}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-xs opacity-70">
                                  {formatTime(message.createdAt)}
                                </span>
                                {message.senderId === currentUser?.id && (
                                  message.isRead ? (
                                    <CheckCheck className="w-3 h-3 opacity-70" />
                                  ) : (
                                    <Check className="w-3 h-3 opacity-70" />
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                  
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <Input
                        placeholder={`Message ${selectedUser.name}...`}
                        value={directMessageInput}
                        onChange={(e) => setDirectMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendDirectMessage()}
                        className="flex-1"
                      />
                      <Button size="sm" variant="outline">
                        <Smile className="w-4 h-4" />
                      </Button>
                      <Button size="sm" onClick={handleSendDirectMessage}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <CardContent>
                  <div className="flex items-center justify-center h-96 text-muted-foreground">
                    <div className="text-center">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Start a conversation</p>
                      <p className="text-sm">Select a user from the list to start messaging</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`border rounded-lg p-4 ${
                      !notification.isRead ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getNotificationColor(notification.type)}>
                          {notification.type}
                        </Badge>
                        <span className="font-medium">{notification.title}</span>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">{notification.message}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {notification.actions?.map((action) => (
                          <Button key={action.id} size="sm" variant="outline">
                            {action.label}
                          </Button>
                        ))}
                      </div>
                      
                      {!notification.isRead && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkNotificationRead(notification.id)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Messages by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.messagesByType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (count / analytics.totalMessages) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Meeting Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.meetingsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="capitalize">{status.replace('-', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, (count / analytics.totalMeetings) * 100)}%`
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Message Dialog */}
      <Dialog open={showNewMessageDialog} onOpenChange={setShowNewMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select User</label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => handleStartConversation(user)}
                  >
                    <div className={`w-2 h-2 rounded-full ${getUserStatusColor(user.status)}`} />
                    <div className="flex-1">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.role} · {user.department}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {getUserStatusText(user.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMessageDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunicationDashboard;
