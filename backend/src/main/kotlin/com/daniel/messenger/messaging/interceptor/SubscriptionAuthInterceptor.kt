package com.daniel.messenger.messaging.interceptor

import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.security.userdetails.UserPrincipal
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.stereotype.Component

private val CHAT_TOPIC_REGEX = Regex("""/topic/chat\.(\d+)(\..*)?""")

@Component
class SubscriptionAuthInterceptor(
    private val chatParticipantRepository: ChatParticipantRepository,
) : ChannelInterceptor {

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*>? {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
            ?: return message

        if (accessor.command != StompCommand.SUBSCRIBE) return message

        val destination = accessor.destination ?: return null
        val chatId = CHAT_TOPIC_REGEX.matchEntire(destination)
            ?.groupValues?.get(1)
            ?.toLongOrNull()
            ?: return message

        val userId = accessor.user
            ?.let { it as? UsernamePasswordAuthenticationToken }
            ?.principal
            ?.let { it as? UserPrincipal }
            ?.user?.id
            ?: return null

        return if (chatParticipantRepository.existsByChat_IdAndUser_Id(chatId, userId)) {
            message
        } else {
            null
        }
    }
}
