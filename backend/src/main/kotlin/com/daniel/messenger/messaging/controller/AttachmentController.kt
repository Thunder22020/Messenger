package com.daniel.messenger.messaging.controller

import com.daniel.messenger.messaging.dto.AttachmentDto
import com.daniel.messenger.messaging.service.AttachmentService
import org.springframework.http.MediaType
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
}
