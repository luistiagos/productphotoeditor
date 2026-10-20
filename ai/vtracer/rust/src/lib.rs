//! Ponte JNI para o vtracer (ARQUITETURA §14.1): RGBA → documento SVG.
use jni::objects::{JByteArray, JClass};
use jni::sys::{jint, jstring};
use jni::JNIEnv;
use std::panic::{catch_unwind, AssertUnwindSafe};
use vtracer::{ColorImage, ColorMode, Config};

fn convert(
    pixels: Vec<u8>,
    width: usize,
    height: usize,
    color_mode: i32,
    color_precision: i32,
    layer_difference: i32,
    filter_speckle: i32,
) -> Result<String, String> {
    if width == 0 || height == 0 || pixels.len() != width * height * 4 {
        return Err(format!("bad image: {}x{} with {} bytes", width, height, pixels.len()));
    }
    let config = Config {
        color_mode: if color_mode == 1 { ColorMode::Binary } else { ColorMode::Color },
        color_precision: color_precision.clamp(1, 8),
        layer_difference: layer_difference.max(0),
        filter_speckle: filter_speckle.max(0) as usize,
        ..Config::default()
    };
    let svg = vtracer::convert(ColorImage { pixels, width, height }, config)?;
    Ok(svg.to_string())
}

#[no_mangle]
pub extern "system" fn Java_com_productphoto_ai_vtracer_VTracerNative_convert<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    rgba: JByteArray<'local>,
    width: jint,
    height: jint,
    color_mode: jint,
    color_precision: jint,
    layer_difference: jint,
    filter_speckle: jint,
) -> jstring {
    let pixels = match env.convert_byte_array(&rgba) {
        Ok(p) => p,
        Err(e) => {
            let _ = env.throw_new("java/lang/IllegalArgumentException", e.to_string());
            return std::ptr::null_mut();
        }
    };
    let result = catch_unwind(AssertUnwindSafe(|| {
        convert(
            pixels,
            width.max(0) as usize,
            height.max(0) as usize,
            color_mode,
            color_precision,
            layer_difference,
            filter_speckle,
        )
    }));
    let message = match result {
        Ok(Ok(svg)) => match env.new_string(svg) {
            Ok(s) => return s.into_raw(),
            Err(e) => e.to_string(),
        },
        Ok(Err(e)) => e,
        Err(_) => String::from("vtracer panicked"),
    };
    let _ = env.throw_new("java/lang/IllegalStateException", message);
    std::ptr::null_mut()
}
