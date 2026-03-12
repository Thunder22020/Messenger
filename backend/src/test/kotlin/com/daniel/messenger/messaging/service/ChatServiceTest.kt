package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.enum.ChatType
import com.daniel.messenger.messaging.exception.CannotCreateChatWithYourselfException
import com.daniel.messenger.messaging.exception.ChatNotFoundException
import com.daniel.messenger.messaging.exception.NotChatParticipantException
import com.daniel.messenger.messaging.repository.ChatParticipantRepository
import com.daniel.messenger.messaging.repository.ChatRepository
import com.daniel.messenger.randomChat
import com.daniel.messenger.randomId
import com.daniel.messenger.randomMessage
import com.daniel.messenger.randomPrivateChatWith
import com.daniel.messenger.randomString
import com.daniel.messenger.randomUser
import com.daniel.messenger.user.service.UserService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.any
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.then
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.messaging.simp.SimpMessagingTemplate
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class ChatServiceTest {

    @Mock
    private lateinit var chatRepository: ChatRepository

    @Mock
    private lateinit var chatParticipantRepository: ChatParticipantRepository

    @Mock
    private lateinit var userService: UserService

    @Mock
    private lateinit var messagingTemplate: SimpMessagingTemplate

    @InjectMocks
    private lateinit var chatService: ChatService

    private val me = randomUser()
    private val other = randomUser()
    private val privateChat = randomPrivateChatWith(me, other)
    private val groupChat = randomChat(type = ChatType.GROUP, title = "group_${randomString()}")
    private val message = randomMessage(chat = privateChat, sender = me)
    private val unknownId = randomId()

    // --- openPrivateChat ---

    @Test
    fun `openPrivateChat - should throw CannotCreateChatWithYourselfException when sender equals receiver`() {
        assertThrows<CannotCreateChatWithYourselfException> {
            chatService.openPrivateChat(senderId = me.id!!, receiverId = me.id!!)
        }
    }

    @Test
    fun `openPrivateChat - should return existing chat id when private chat already exists`() {
        given(chatParticipantRepository.findPrivateChatIdByUserIds(listOf(me.id!!, other.id!!))).willReturn(privateChat.id)
        given(chatRepository.findById(privateChat.id!!)).willReturn(Optional.of(privateChat))

        val result = chatService.openPrivateChat(senderId = me.id!!, receiverId = other.id!!)

        assertThat(result.chatId).isEqualTo(privateChat.id)
    }

    @Test
    fun `openPrivateChat - should create and return a new chat when none exists between the two users`() {
        val newChat = randomChat()
        given(chatParticipantRepository.findPrivateChatIdByUserIds(listOf(me.id!!, other.id!!))).willReturn(null)
        given(chatRepository.save(any())).willReturn(newChat)
        given(userService.findByIdOrThrow(me.id!!)).willReturn(me)
        given(userService.findByIdOrThrow(other.id!!)).willReturn(other)

        val result = chatService.openPrivateChat(senderId = me.id!!, receiverId = other.id!!)

        assertThat(result.chatId).isEqualTo(newChat.id)
    }

    // --- isChatParticipantOrThrow ---

    @Test
    fun `isChatParticipantOrThrow - should not throw when user is a chat participant`() {
        given(chatParticipantRepository.existsByChat_IdAndUser_Id(privateChat.id!!, me.id!!)).willReturn(true)

        chatService.isChatParticipantOrThrow(chatId = privateChat.id!!, userId = me.id!!)
    }

    @Test
    fun `isChatParticipantOrThrow - should throw NotChatParticipantException when user is not a participant`() {
        given(chatParticipantRepository.existsByChat_IdAndUser_Id(privateChat.id!!, unknownId)).willReturn(false)

        assertThrows<NotChatParticipantException> {
            chatService.isChatParticipantOrThrow(chatId = privateChat.id!!, userId = unknownId)
        }
    }

    // --- findByIdOrThrow ---

    @Test
    fun `findByIdOrThrow - should return chat when found`() {
        given(chatRepository.findById(privateChat.id!!)).willReturn(Optional.of(privateChat))

        val result = chatService.findByIdOrThrow(privateChat.id!!)

        assertThat(result.id).isEqualTo(privateChat.id)
    }

    @Test
    fun `findByIdOrThrow - should throw ChatNotFoundException when chat does not exist`() {
        given(chatRepository.findById(unknownId)).willReturn(Optional.empty())

        assertThrows<ChatNotFoundException> { chatService.findByIdOrThrow(unknownId) }
    }

    // --- getUserChats ---

    @Test
    fun `getUserChats - should map chats to responses with the correct display name for the current user`() {
        given(chatRepository.findAllUserChatsWithParticipants(me.id!!)).willReturn(listOf(privateChat))

        val result = chatService.getUserChats(userId = me.id!!)

        assertThat(result).hasSize(1)
        assertThat(result[0].chatId).isEqualTo(privateChat.id)
        assertThat(result[0].type).isEqualTo(ChatType.PRIVATE)
        assertThat(result[0].displayName).isEqualTo(other.username)
    }

    // --- getDisplayName ---

    @Test
    fun `getDisplayName - should return the other participant username for a PRIVATE chat`() {
        val name = chatService.getDisplayName(privateChat, userId = me.id!!)

        assertThat(name).isEqualTo(other.username)
    }

    @Test
    fun `getDisplayName - should return the group title for a GROUP chat`() {
        val name = chatService.getDisplayName(groupChat, userId = me.id!!)

        assertThat(name).isEqualTo(groupChat.title)
    }

    // --- updateChatLastMessage ---

    @Test
    fun `updateChatLastMessage - should update last message fields on the chat and persist`() {
        given(chatRepository.save(privateChat)).willReturn(privateChat)

        chatService.updateChatLastMessage(privateChat, message)

        assertThat(privateChat.lastMessageId).isEqualTo(message.id)
        assertThat(privateChat.lastMessageContent).isEqualTo(message.content)
        assertThat(privateChat.lastMessageCreatedAt).isEqualTo(message.createdAt)
        then(chatRepository).should().save(privateChat)
    }
}
