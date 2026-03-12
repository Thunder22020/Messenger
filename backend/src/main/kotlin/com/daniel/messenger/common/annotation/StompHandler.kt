package com.daniel.messenger.common.annotation

import org.springframework.stereotype.Controller

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@Controller
annotation class StompHandler
