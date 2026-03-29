package com.daniel.messenger.messaging.handler

import com.daniel.messenger.common.annotation.StompHandler
import com.daniel.messenger.messaging.dto.request.SendMessageRequest
import com.daniel.messenger.messaging.dto.request.TypingRequest
import com.daniel.messenger.messaging.service.ChatHandlerService
import com.daniel.messenger.security.util.toUserPrincipal
import jakarta.validation.Valid
import org.springframework.messaging.handler.annotation.MessageMapping
import java.security.Principal

@StompHandler
class ChatHandler(
    private val chatHandlerService: ChatHandlerService,
) {
    @MessageMapping("/chat.send")
    fun sendMessage(
        @Valid message: SendMessageRequest,
        principal: Principal
    ) {
        val sender = principal.toUserPrincipal().user
        chatHandlerService.sendMessage(message, sender)
    }

    @MessageMapping("/chat.typing")
    fun typing(
        request: TypingRequest,
        principal: Principal
    ) {
        val userPrincipal = principal.toUserPrincipal()
        chatHandlerService.broadcastTyping(request, userPrincipal.user.username)
    }
}
