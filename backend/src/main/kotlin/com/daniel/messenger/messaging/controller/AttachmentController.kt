package com.daniel.messenger.messaging.controller

import com.daniel.messenger.messaging.dto.AttachmentDto
import com.daniel.messenger.messaging.service.AttachmentService
import com.daniel.messenger.security.userdetails.UserPrincipal
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/attachments")
class AttachmentController(private val attachmentService: AttachmentService) {
    @PostMapping("/upload", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun upload(@RequestParam("file") file: MultipartFile): AttachmentDto =
        attachmentService.upload(file)

    @GetMapping
    fun getAttachments(
        @RequestParam chatId: Long,
        @RequestParam(required = false) before: Long?,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): List<AttachmentDto> {
        val userId = requireNotNull(userPrincipal.user.id)
        return if (before == null) {
            attachmentService.getAttachments(chatId, userId)
        } else {
            attachmentService.getAttachmentsBefore(chatId, before, userId)
        }
    }
}
