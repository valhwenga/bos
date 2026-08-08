import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CommunicationDashboard from '@/components/CommunicationDashboard';
import { CommunicationStore } from '@/lib/communicationStore';
import { MessageSquare, Video, Users, Calendar, Bell, Phone, Mic, Settings } from 'lucide-react';

const CommunicationPage: React.FC = () => {
  const handleStartInstantMeeting = () => {
    const meeting = CommunicationStore.createMeeting({
      title: 'Instant Meeting',
      type: 'instant',
      hostId: 'current_user',
      hostName: 'Current User',
      participantIds: ['current_user'],
      participants: [{
        userId: 'current_user',
        userName: 'Current User',
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
    console.log('Instant meeting started:', meeting);
  };

  const handleScheduleMeeting = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const meeting = CommunicationStore.createMeeting({
      title: 'Team Standup Meeting',
      description: 'Weekly team standup to discuss progress and blockers',
      type: 'scheduled',
      hostId: 'current_user',
      hostName: 'Current User',
      participantIds: ['user1', 'user2', 'user3'],
      participants: [
        {
          userId: 'current_user',
          userName: 'Current User',
          role: 'host',
          isMuted: false,
          isVideoOn: true,
          isScreenSharing: false,
        },
        {
          userId: 'user1',
          userName: 'Team Member 1',
          role: 'participant',
          isMuted: false,
          isVideoOn: false,
          isScreenSharing: false,
        },
        {
          userId: 'user2',
          userName: 'Team Member 2',
          role: 'participant',
          isMuted: false,
          isVideoOn: false,
          isScreenSharing: false,
        },
        {
          userId: 'user3',
          userName: 'Team Member 3',
          role: 'participant',
          isMuted: false,
          isVideoOn: false,
          isScreenSharing: false,
        },
      ],
      scheduledStart: tomorrow.toISOString(),
      scheduledEnd: new Date(tomorrow.getTime() + 30 * 60 * 1000).toISOString(),
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
    console.log('Meeting scheduled:', meeting);
  };

  const handleCreateWorkspace = () => {
    const workspace = CommunicationStore.createWorkspace({
      name: 'Project Alpha Team',
      description: 'Cross-functional team for Project Alpha',
      type: 'project',
      ownerId: 'current_user',
      ownerName: 'Current User',
      memberIds: ['current_user', 'user1', 'user2'],
      members: [
        {
          userId: 'current_user',
          userName: 'Current User',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          permissions: ['admin', 'create', 'edit', 'delete'],
        },
        {
          userId: 'user1',
          userName: 'Team Member 1',
          role: 'admin',
          joinedAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          permissions: ['create', 'edit'],
        },
        {
          userId: 'user2',
          userName: 'Team Member 2',
          role: 'member',
          joinedAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          permissions: ['read', 'write'],
        },
      ],
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
    console.log('Workspace created:', workspace);
  };

  const handleSendTestMessage = () => {
    const conversations = CommunicationStore.getConversations();
    if (conversations.length > 0) {
      const message = CommunicationStore.createMessage({
        conversationId: conversations[0].id,
        senderId: 'current_user',
        senderName: 'Current User',
        content: 'Test message from communication system',
        type: 'text',
        mentions: [],
        replyTo: undefined,
      });
      console.log('Test message sent:', message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Communication & Collaboration</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>»</span>
            <span className="text-primary">Communication</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={handleStartInstantMeeting}>
            <Video className="w-4 h-4 mr-2" />
            Start Meeting
          </Button>
          <Button variant="outline" onClick={handleScheduleMeeting}>
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </Button>
          <Button variant="outline" onClick={handleCreateWorkspace}>
            <Users className="w-4 h-4 mr-2" />
            New Workspace
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Communication Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Team Messaging</p>
                <p className="font-semibold">Real-time Chat</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Video Conferencing</p>
                <p className="font-semibold">HD Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Team Workspaces</p>
                <p className="font-semibold">Collaboration Hub</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Team Calendar</p>
                <p className="font-semibold">Schedule & Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleSendTestMessage}>
          <CardContent className="p-4 text-center">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="font-medium">Send Message</p>
            <p className="text-xs text-muted-foreground">Quick chat</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleStartInstantMeeting}>
          <CardContent className="p-4 text-center">
            <Video className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="font-medium">Instant Meeting</p>
            <p className="text-xs text-muted-foreground">Start now</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <Phone className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="font-medium">Voice Call</p>
            <p className="text-xs text-muted-foreground">Audio only</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <Bell className="w-8 h-8 mx-auto mb-2 text-orange-500" />
            <p className="font-medium">Notifications</p>
            <p className="text-xs text-muted-foreground">View alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Communication Dashboard */}
      <CommunicationDashboard />
    </div>
  );
};

export default CommunicationPage;
