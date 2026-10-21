cmake_minimum_required(VERSION 3.16)
project(tc_native LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# TC-P19: 消除 MSVC 中文 UTF-8 警告 (C4819)
if(MSVC)
  add_compile_options(/utf-8)
endif()

# TC-P19: node-addon-api 路径直接取项目根 node_modules(不再执行 node 解析,
# 根治 .include 自带引号 / include_dir 属性不存在 两类坑); 缺包当场报错不静默
set(NODE_ADDON_API_DIR "${CMAKE_SOURCE_DIR}/node_modules/node-addon-api")
if(NOT EXISTS "${NODE_ADDON_API_DIR}/napi.h")
  message(FATAL_ERROR "node-addon-api 头文件缺失: ${NODE_ADDON_API_DIR}/napi.h -- 请先运行 npm install")
endif()
file(TO_CMAKE_PATH "${NODE_ADDON_API_DIR}" NODE_ADDON_API_DIR)

add_library(tc_native SHARED tc_native.cc ${CMAKE_JS_SRC})
target_include_directories(tc_native PRIVATE ${CMAKE_JS_INC} "${NODE_ADDON_API_DIR}")
target_link_libraries(tc_native PRIVATE ${CMAKE_JS_LIB})
set_target_properties(tc_native PROPERTIES PREFIX "" SUFFIX ".node")

# 构建成功后自动复制到 resources/bin
add_custom_command(TARGET tc_native POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E make_directory "${CMAKE_CURRENT_SOURCE_DIR}/../resources/bin"
  COMMAND ${CMAKE_COMMAND} -E copy_if_different "$<TARGET_FILE:tc_native>" "${CMAKE_CURRENT_SOURCE_DIR}/../resources/bin/tc_native.node")
