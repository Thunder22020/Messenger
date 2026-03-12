package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.randomChatParticipant
import com.daniel.messenger.randomMessageResponse
import com.daniel.messenger.randomSendMessageRequest
import com.daniel.messenger.randomUser
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.eq
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.then
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.user.SimpUserRegistry

@ExtendWith(MockitoExtension::class)
class ChatHandlerServiceTest {

    @Mock
    private lateinit var messageService: MessageService

    @Mock
    private lateinit var messagingTemplate: SimpMessagingTemplate

    @Mock
    private lateinit var chatParticipantRepository: ChatParticipantRepository

    @Mock
    private lateinit var simpUserRegistry: SimpUserRegistry

    @InjectMocks
    private lateinit var chatHandlerService: ChatHandlerService

    private val sender = randomUser()
    private val participants = listOf(randomChatParticipant(user = sender), randomChatParticipant())
    private val request = randomSendMessageRequest()
    private val response = randomMessageResponse(content = request.content)

    @Test
    fun `sendMessage - should broadcast to chat topic and send update event to every participant`() {
        given(messageService.sendMessage(request, sender.id!!)).willReturn(response)
        given(chatParticipantRepository.findAllWithUserByChatId(request.chatId)).willReturn(participants)

        chatHandlerService.sendMessage(request, senderId = sender.id!!)

        then(messagingTemplate).should().convertAndSend("/topic/chat.${request.chatId}", response)
        participants.forEach { participant ->
            then(messagingTemplate).should()
                .convertAndSendToUser(eq(participant.user.username), eq("/queue/chat-updates"), any())
        }
    }
}
