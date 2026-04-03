package com.daniel.messenger.presence

import com.daniel.messenger.call.service.CallService
import com.daniel.messenger.security.util.toUserPrincipal
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.web.socket.messaging.SessionConnectedEvent
import org.springframework.web.socket.messaging.SessionDisconnectEvent

@Component
class PresenceEventListener(
    private val presenceService: PresenceService,
    private val callService: CallService,
) {
    private val log: Logger = LoggerFactory.getLogger(PresenceEventListener::class.java)

    @EventListener
    fun onConnect(event: SessionConnectedEvent) {
        val user = event.user?.toUserPrincipal()?.user ?: return
        presenceService.userConnected(user.id ?: return)
    }

    @EventListener
    fun onDisconnect(event: SessionDisconnectEvent) {
        val user = event.user?.toUserPrincipal()?.user ?: return
        val userId = user.id ?: return
        presenceService.userDisconnected(userId, user.username)
        callService.handleDisconnect(userId, user.username, event.sessionId)
    }
}
