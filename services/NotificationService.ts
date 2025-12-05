import { UnifiedNotificationService } from './UnifiedNotificationService'
import { SimpleNotificationService } from './SimpleNotificationService'
import { PushNotificationService } from './PushNotificationService'

// Facade to consolidate notification entry points.
// For now it delegates to existing services; future refactors can swap internals here.
export class NotificationService {
  static async notifyNewMessage(
    chatId: string,
    senderId: string,
    receiverId: string,
    content: string,
    senderName: string,
  ) {
    return UnifiedNotificationService.notifyNewMessage(
      chatId,
      senderId,
      receiverId,
      content,
      senderName,
    )
  }

  static async notifyTaskApplication(
    taskId: string,
    taskTitle: string,
    customerId: string,
    taskerName: string,
    applicationId: string,
  ) {
    return UnifiedNotificationService.notifyTaskApplication(
      taskId,
      taskTitle,
      customerId,
      taskerName,
      applicationId,
    )
  }

  static async notifyNewTaskPosted(
    taskId: string,
    title: string,
    customerName: string,
    taskerIds: string[],
  ) {
    return UnifiedNotificationService.notifyNewTaskPosted(taskId, title, customerName, taskerIds)
  }

  static async notifySimple(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    return SimpleNotificationService.sendNotification(userId, title, body, data)
  }

  static async registerPushToken(userId: string, token: string) {
    return PushNotificationService.registerPushToken(userId, token)
  }
}
