package com.daniel.messenger

import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.dto.request.SendMessageRequest
import com.daniel.messenger.messaging.entity.Chat
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.entity.ChatParticipantId
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.enum.ChatType
import com.daniel.messenger.security.entity.RefreshToken
import com.daniel.messenger.user.dto.UserRequest
import com.daniel.messenger.user.entity.User
import java.time.Instant
import java.util.UUID
import kotlin.random.Random

// --- Primitive helpers ---

fun randomId(): Long = Random.nextLong(1, 100_000)

fun randomString(): String = UUID.randomUUID().toString().take(8)

fun randomUsername(): String = "user_${randomString()}"

/** Generates a 256-bit secret suitable for HMAC-SHA JWT signing. */
fun randomSecret(): String = UUID.randomUUID().toString().replace("-", "") // 32 bytes = 256 bits

fun randomInstant(offsetSeconds: Long = 3600): Instant = Instant.now().plusSeconds(offsetSeconds)

// --- Domain factories ---

fun randomUser(
    id: Long = randomId(),
    username: String = randomUsername(),
    password: String = "hashed_${randomString()}",
): User = User(id = id, username = username, password = password)

fun randomChat(
    id: Long = randomId(),
    type: ChatType = ChatType.PRIVATE,
    title: String? = null,
): Chat = Chat(id = id, type = type, title = title)

fun randomPrivateChatWith(vararg users: User): Chat {
    val chat = randomChat(type = ChatType.PRIVATE)
    chat.participants = users.map { user ->
        ChatParticipant(ChatParticipantId(chat.id, user.id), chat, user)
    }.toMutableList()
    return chat
}

fun randomChatParticipant(
    chat: Chat = randomChat(),
    user: User = randomUser(),
): ChatParticipant = ChatParticipant(
    id = ChatParticipantId(chat.id, user.id),
    chat = chat,
    user = user,
)

fun randomMessage(
    id: Long = randomId(),
    sender: User = randomUser(),
    content: String = randomString(),
    chat: Chat = randomChat(),
    createdAt: Instant = Instant.now(),
): MessageEntity = MessageEntity(id = id, sender = sender, content = content, chat = chat, createdAt = createdAt)

fun randomRefreshToken(
    user: User = randomUser(),
    expiryDate: Instant = randomInstant(),
): RefreshToken = RefreshToken(
    token = UUID.randomUUID().toString(),
    expiryDate = expiryDate,
    user = user,
)

// --- DTO factories ---

fun randomUserRequest(
    username: String = randomUsername(),
    password: String = randomString(),
): UserRequest = UserRequest(username = username, password = password)

fun randomSendMessageRequest(
    chatId: Long = randomId(),
    content: String = randomString(),
): SendMessageRequest = SendMessageRequest(chatId = chatId, content = content)

fun randomMessageResponse(
    id: Long = randomId(),
    content: String = randomString(),
    sender: String = randomUsername(),
    createdAt: Instant = Instant.now(),
): MessageResponse = MessageResponse(
    id = id,
    content = content,
    sender = sender,
    createdAt = createdAt,
    deletedAt = null,
    editedAt = null
)
