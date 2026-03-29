package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.AttachmentDto
import com.daniel.messenger.messaging.entity.Attachment
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.enum.AttachmentType
import com.daniel.messenger.messaging.repository.AttachmentRepository
import com.daniel.messenger.messaging.toDto
import com.daniel.messenger.messaging.toDtoWithMeta
import com.daniel.messenger.storage.S3StorageService
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

@Service
class AttachmentService(
    private val s3StorageService: S3StorageService,
    private val attachmentRepository: AttachmentRepository,
    private val chatAccessService: ChatAccessService,
) {
    fun upload(file: MultipartFile): AttachmentDto {
        val contentType = file.contentType ?: "application/octet-stream"
        val originalName = file.originalFilename ?: "file"
        val ext = originalName.substringAfterLast('.', "bin")
        val key = "${UUID.randomUUID()}.$ext"
        val url = s3StorageService.upload(
            key,
            file.inputStream,
            contentType,
            file.size
        )

        val attachment = attachmentRepository.save(
            Attachment(
                message = null,
                attachmentType = detectType(contentType),
                fileName = originalName,
                mimeType = contentType,
                fileSize = file.size,
                filePath = url,
            )
        )
        return attachment.toDto()
    }

    private fun detectType(contentType: String): AttachmentType = when {
        contentType.startsWith("image/") -> AttachmentType.PHOTO
        contentType.startsWith("video/") -> AttachmentType.VIDEO
        contentType.startsWith("audio/") -> AttachmentType.AUDIO
        else -> AttachmentType.FILE
    }

    @Transactional
    fun deleteByMessageId(messageId: Long) {
        val keys = deleteByMessageIdReturnKeys(messageId)
        deleteFromS3Async(keys)
    }

    fun deleteFromS3Async(keys: List<String>) {
        if (keys.isNotEmpty()) {
            s3StorageService.deleteFromS3Async(keys)
        }
    }

    @Transactional
    fun deleteByChatIdReturnKeys(chatId: Long) =
        normalizeKeys(attachmentRepository.deleteByChatIdReturningFilePaths(chatId))

    @Transactional
    fun deleteByMessageIdReturnKeys(messageId: Long) =
        normalizeKeys(attachmentRepository.deleteByMessageIdReturningFilePaths(messageId))

    fun normalizeKeys(filePaths: List<String>) = filePaths.map { it.substringAfterLast("/") }

    fun linkToMessage(attachmentIds: List<Long>, message: MessageEntity): List<Attachment> {
        attachmentIds.ifEmpty { return emptyList() }
        attachmentRepository.bulkLinkToMessage(attachmentIds, message)
        return attachmentRepository.findAllByMessageId(requireNotNull(message.id))
    }

    fun getMediaAttachments(chatId: Long, userId: Long, before: Long? = null): List<AttachmentDto> {
        checkAccess(chatId, userId)
        val pageable = PageRequest.of(0, ATT_PAGE_SIZE)
        val attachments = if (before != null) {
            attachmentRepository.findAllMediaByChatIdBefore(chatId, before, pageable)
        } else {
            attachmentRepository.findAllMediaByChatId(chatId, pageable)
        }
        return attachments.map { it.toDtoWithMeta() }
    }

    fun getFilesAttachments(chatId: Long, userId: Long, before: Long? = null): List<AttachmentDto> {
        checkAccess(chatId, userId)
        val pageable = PageRequest.of(0, ATT_PAGE_SIZE)
        val attachments = if (before != null) {
            attachmentRepository.findAllFilesByChatIdBefore(chatId, before, pageable)
        } else {
            attachmentRepository.findAllFilesByChatId(chatId, pageable)
        }
        return attachments.map { it.toDtoWithMeta() }
    }

    fun existsByMessageId(id: Long) =
        attachmentRepository.existsByMessageId(id)

    fun getAttachmentsByMessageId(messageId: Long) =
        attachmentRepository.findAllByMessageId(messageId)

    fun getAttachmentsGroupedByMessageId(messageIds: List<Long>) = attachmentRepository
            .findAllByMessageIdIn(messageIds)
            .groupBy{requireNotNull(it.message?.id)}

    private fun checkAccess(chatId: Long, userId: Long) {
        chatAccessService.isChatParticipantOrThrow(chatId, userId)
    }

    companion object {
        private const val ATT_PAGE_SIZE = 20
    }
}
