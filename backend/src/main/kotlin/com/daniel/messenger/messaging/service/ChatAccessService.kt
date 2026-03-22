package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.exception.NotChatParticipantException
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import org.springframework.stereotype.Service

@Service
class ChatAccessService(
    private val chatParticipantRepository: ChatParticipantRepository
) {
    fun isChatParticipantOrThrow(chatId: Long, userId: Long) {
        if (!chatParticipantRepository.existsByChat_IdAndUser_Id(chatId, userId)) {
            throw NotChatParticipantException("Forbidden")
        }
    }

    fun getChatParticipantOrThrow(chatId: Long, userId: Long) =
        chatParticipantRepository.findByChat_IdAndUser_Id(chatId, userId)
            ?: throw NotChatParticipantException("Forbidden")
}
