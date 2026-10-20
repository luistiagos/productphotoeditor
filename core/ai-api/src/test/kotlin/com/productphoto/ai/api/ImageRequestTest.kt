package com.productphoto.ai.api

import android.graphics.Bitmap
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

/**
 * O android.jar de teste não cria Bitmap (ARQUITETURA §19.1): a instância vem do Unsafe e nunca é lida,
 * featuresNeeded só olha a presença das imagens.
 */
internal fun stubImage(): RgbaImage {
    val unsafe = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe").apply { isAccessible = true }.get(null)
    val bitmap = unsafe.javaClass.getMethod("allocateInstance", Class::class.java).invoke(unsafe, Bitmap::class.java) as Bitmap
    return RgbaImage(bitmap)
}

class ImageRequestTest {
    private val img = stubImage()
    private val mask = Mask(2, 2, ByteArray(4))

    @Test
    fun `features needed by each kind of request`() {
        assertEquals(setOf(ImageFeature.TXT2IMG), ImageRequest("gato").featuresNeeded())
        assertEquals(setOf(ImageFeature.IMG2IMG), ImageRequest("gato", init = img, strength = .5f).featuresNeeded())
        assertEquals(setOf(ImageFeature.INPAINT), ImageRequest("gato", init = img, inpaintMask = mask).featuresNeeded())
        assertEquals(
            setOf(ImageFeature.INPAINT),
            ImageRequest("gato", init = img, inpaintMask = mask, maskInvert = true).featuresNeeded(),
        )
        assertEquals(
            setOf(ImageFeature.TXT2IMG, ImageFeature.CONTROL_CANNY),
            ImageRequest("logo", control = Control(Control.Kind.CANNY, img)).featuresNeeded(),
        )
        assertEquals(
            setOf(ImageFeature.IMG2IMG, ImageFeature.CONTROL_SCRIBBLE),
            ImageRequest("logo", init = img, control = Control(Control.Kind.SCRIBBLE, img, .8f)).featuresNeeded(),
        )
    }

    @Test
    fun `mask without init and zero count are rejected`() {
        for (build in listOf({ ImageRequest("x", inpaintMask = mask) }, { ImageRequest("x", count = 0) })) {
            try {
                build()
                fail()
            } catch (_: IllegalArgumentException) {
            }
        }
    }

    @Test
    fun `snapTo8 rounds to the nearest multiple of 8`() {
        assertEquals(512, snapTo8(512))
        assertEquals(512, snapTo8(515))
        assertEquals(520, snapTo8(516))
        assertEquals(768, snapTo8(767))
        assertEquals(8, snapTo8(0))
        assertEquals(8, snapTo8(3))
    }
}
