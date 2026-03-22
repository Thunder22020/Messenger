package com.daniel.messenger.messaging.service

import com.daniel.messenger.messaging.dto.AttachmentDto
import com.daniel.messenger.messaging.entity.Attachment
import com.daniel.messenger.messaging.entity.MessageEntity
import com.daniel.messenger.messaging.enum.AttachmentType
import com.daniel.messenger.messaging.repository.AttachmentRepository
import com.daniel.messenger.messaging.toDto
import com.daniel.messenger.messaging.toDtoWithMeta
import com.daniel.messenger.storage.S3StorageService
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Async
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
    private val log = LoggerFactory.getLogger(AttachmentService::class.java)
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
        val keys = attachmentRepository.deleteAllByMessageIdReturningFilePaths(messageId)
            .map { it.substringAfterLast("/") }
        if (keys.isNotEmpty()) {
            deleteFromS3Async(keys)
        }
    }

    @Async
    fun deleteFromS3Async(keys: List<String>) {
        keys.forEach { deleteFromS3OrLog(it) }
    }

    private fun deleteFromS3OrLog(key: String) {
        try {
            s3StorageService.delete(key)
        } catch (e: Exception) {
            log.warn("Failed to delete S3 object: {}", key, e)
        }
    }

    fun linkToMessage(attachmentIds: List<Long>, message: MessageEntity): List<Attachment> {
        if (attachmentIds.isEmpty()) return emptyList()
        attachmentRepository.bulkLinkToMessage(attachmentIds, message)
        return attachmentRepository.findAllByMessageId(requireNotNull(message.id))
    }

    fun getMediaAttachments(chatId: Long, userId: Long): List<AttachmentDto> {
        checkAccess(chatId, userId)
        val pageable = PageRequest.of(0, ATT_PAGE_SIZE)
        return attachmentRepository.findAllMediaByChatId(chatId, pageable).map { it.toDtoWithMeta() }
    }

    fun getMediaAttachmentsBefore(chatId: Long, before: Long, userId: Long): List<AttachmentDto> {
        checkAccess(chatId, userId)
        val pageable = PageRequest.of(0, ATT_PAGE_SIZE)
        return attachmentRepository.findAllMediaByChatIdBefore(chatId, before, pageable).map { it.toDtoWithMeta() }
    }

    fun getFilesAttachments(chatId: Long, userId: Long): List<AttachmentDto> {
        checkAccess(chatId, userId)
        val pageable = PageRequest.of(0, ATT_PAGE_SIZE)
        return attachmentRepository.findAllFilesByChatId(chatId, pageable).map { it.toDtoWithMeta() }
    }

    fun getFilesAttachmentsBefore(chatId: Long, before: Long, userId: Long): List<AttachmentDto> {
        checkAccess(chatId, userId)
        val pageable = PageRequest.of(0, ATT_PAGE_SIZE)
        return attachmentRepository.findAllFilesByChatIdBefore(chatId, before, pageable).map { it.toDtoWithMeta() }
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
