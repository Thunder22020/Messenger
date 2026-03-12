package com.daniel.messenger.messaging.handler

import com.daniel.messenger.common.annotation.StompHandler
import com.daniel.messenger.messaging.dto.SendMessageRequest
import com.daniel.messenger.messaging.dto.TypingRequest
import com.daniel.messenger.messaging.service.ChatHandlerService
import com.daniel.messenger.security.util.toUserPrincipal
import org.springframework.messaging.handler.annotation.MessageMapping
import java.security.Principal

@StompHandler
class ChatHandler(
    private val chatHandlerService: ChatHandlerService,
) {
    @MessageMapping("/chat.send")
    fun sendMessage(
        message: SendMessageRequest,
        principal: Principal
    ) {
        val userPrincipal = principal.toUserPrincipal()
        val senderId = requireNotNull(userPrincipal.user.id)
        chatHandlerService.sendMessage(message, senderId)
    }

    @MessageMapping("/chat.typing")
    fun typing(
        request: TypingRequest,
        principal: Principal
    ) {
        val userPrincipal = principal.toUserPrincipal()
        val userId = requireNotNull(userPrincipal.user.id)
        chatHandlerService.broadcastTyping(request, userPrincipal.user.username, userId)
    }
}
