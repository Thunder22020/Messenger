package com.daniel.messenger.call.service

import com.daniel.messenger.call.dto.CallEvent
import com.daniel.messenger.call.dto.CallSignalMessage
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service

@Service
class CallNotificationService(
    private val messagingTemplate: SimpMessagingTemplate,
) {
    fun sendCallEvent(username: String, event: CallEvent) {
        messagingTemplate.convertAndSendToUser(username, "/queue/call", event)
    }

    fun sendSignalMessage(username: String, message: CallSignalMessage) {
        messagingTemplate.convertAndSendToUser(username, "/queue/call.signal", message)
    }
}
