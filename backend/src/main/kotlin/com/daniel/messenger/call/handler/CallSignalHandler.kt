package com.daniel.messenger.call.handler

import com.daniel.messenger.call.dto.CallSignalMessage
import com.daniel.messenger.call.service.CallNotificationService
import com.daniel.messenger.call.store.ActiveCallStore
import com.daniel.messenger.common.annotation.StompHandler
import org.springframework.messaging.handler.annotation.MessageMapping
import java.security.Principal

@StompHandler
class CallSignalHandler(
    private val callNotificationService: CallNotificationService,
    private val activeCallStore: ActiveCallStore,
) {
    @MessageMapping("/call.signal")
    fun relay(message: CallSignalMessage, principal: Principal) {
        val call = activeCallStore.find(message.callId) ?: return
        val senderUsername = principal.name
        if (senderUsername != call.callerUsername && senderUsername != call.receiverUsername) return
        val peerUsername = if (senderUsername == call.callerUsername) call.receiverUsername else call.callerUsername
        callNotificationService.sendSignalMessage(peerUsername, message)
    }
}
