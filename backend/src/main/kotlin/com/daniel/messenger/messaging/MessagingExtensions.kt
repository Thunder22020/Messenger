package com.daniel.messenger.messaging

import com.daniel.messenger.messaging.dto.AttachmentDto
import com.daniel.messenger.messaging.dto.ChatDTO
import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.dto.ReplyPreviewDto
import com.daniel.messenger.messaging.dto.event.snapshots.ParticipantSnapshot
import com.daniel.messenger.messaging.entity.Attachment
import com.daniel.messenger.messaging.entity.Chat
import com.daniel.messenger.messaging.entity.ChatParticipant
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.enum.AttachmentType
import java.time.Instant

fun MessageEntity.toResponse(
    senderUsername: String? = null,
    replyPreview: ReplyPreviewDto? = null,
    attachments: List<AttachmentDto> = emptyList(),
): MessageResponse = MessageResponse(
    id = requireNotNull(id),
    content = if (deletedAt != null) "" else content,
    sender = senderUsername ?: sender.username,
    createdAt = createdAt,
    editedAt = editedAt,
    deletedAt = deletedAt,
    replyToMessageId = replyToMessageId,
    replyPreview = replyPreview,
    attachments = attachments,
)

fun Attachment.toDto(): AttachmentDto = AttachmentDto(
    id = requireNotNull(id),
    url = filePath,
    type = attachmentType,
    fileName = fileName,
    mimeType = mimeType,
    fileSize = fileSize,
)

fun Attachment.toDtoWithMeta(): AttachmentDto = AttachmentDto(
    id = requireNotNull(id),
    url = filePath,
    type = attachmentType,
    fileName = fileName,
    mimeType = mimeType,
    fileSize = fileSize,
    createdAt = createdAt,
    senderUsername = message?.sender?.username,
)

fun Chat.toDto(): ChatDTO = ChatDTO(
    id = requireNotNull(id),
    type = type,
    title = title ?: "",
    lastMessageId = lastMessageId ?: 0,
    lastMessageContent = lastMessageContent ?: "",
    lastMessageSender = lastMessageSender,
    lastMessageCreatedAt = lastMessageCreatedAt ?: Instant.now(),
    createdAt = createdAt
)

fun ChatParticipant.toSnapshot() = ParticipantSnapshot(
    username = user.username,
    unreadCount = unreadCount,
)

fun attachmentPreviewText(type: AttachmentType, count: Int): String = when (type) {
    AttachmentType.PHOTO -> if (count == 1) "📷 Photo" else "📷 $count photos"
    AttachmentType.VIDEO -> if (count == 1) "🎥 Video" else "🎥 $count videos"
    AttachmentType.AUDIO -> if (count == 1) "🎧 Audio" else "🎧 $count audios"
    AttachmentType.FILE -> if (count == 1) "📄 File" else "📄 $count files"
}

fun resolveContentPreview(response: MessageResponse): String? {
    if (!response.content.isNullOrBlank()) return response.content
    if (response.attachments.isEmpty()) return response.content
    return attachmentPreviewText(response.attachments.first().type, response.attachments.size)
}
