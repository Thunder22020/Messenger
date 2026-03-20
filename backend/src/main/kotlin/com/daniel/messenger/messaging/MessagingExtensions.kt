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
    AttachmentType.PHOTO -> if (count == 1) "\uD83D\uDCF7 Photo" else "\uD83D\uDCF7 $count photos"
    AttachmentType.VIDEO -> if (count == 1) "\uD83C\uDFA5 Video" else "\uD83C\uDFA5 $count videos"
    AttachmentType.AUDIO -> if (count == 1) "\uD83C\uDFA7 Audio" else "\uD83C\uDFA7 $count audios"
    AttachmentType.FILE -> if (count == 1) "\uD83D\uDCC4 File" else "\uD83D\uDCC4 $count files"
}

fun resolveContentPreview(response: MessageResponse): String? {
    if (!response.content.isNullOrBlank()) return response.content
    if (response.attachments.isEmpty()) return response.content
    return attachmentPreviewText(response.attachments.first().type, response.attachments.size)
}
