package com.daniel.messenger.presence

import com.daniel.messenger.common.annotation.StompHandler
import com.daniel.messenger.security.util.toUserPrincipal
import org.springframework.messaging.handler.annotation.MessageMapping
import java.security.Principal

@StompHandler
class PresenceHandler(
    private val presenceService: PresenceService,
) {
    @MessageMapping("/presence.heartbeat")
    fun onHeartbeat(principal: Principal) {
        presenceService.heartbeat(principal.toUserPrincipal().user.username)
    }
}
