import 'package:dio/dio.dart';
import 'dart:convert';

class AIService {
  /// API key should be set from environment or config file
  /// Get it from https://console.x.ai/
  static String get grokApiKey => const String.fromEnvironment('GROK_API_KEY', defaultValue: '');
  static const String grokApiUrl = 'https://api.x.ai/v1/chat/completions';
  
  // Update this to your local machine's IP address if running on physical device, 
  // or 10.0.2.2 if on Android emulator.
  static const String ollamaApiUrl = 'http://10.0.2.2:11434/api/generate';

  final Dio _dio = Dio();

  /// Generates a schedule using Grok based on user's selected subjects
  Future<String> generateSchedule({
    required List<String> subjects,
    required List<String> weakSubjects,
    required String portionStr,
    required String personalPlans,
  }) async {
    try {
      final response = await _dio.post(
        grokApiUrl,
        options: Options(
          headers: {
            'Authorization': 'Bearer $grokApiKey',
            'Content-Type': 'application/json',
          },
        ),
        data: {
          'model': 'grok-beta',
          'messages': [
            {
              'role': 'system',
              'content': 'You are a master study scheduler. Given the subjects, weak subjects to prioritize, upcoming portion, and user\'s personal plans, create a structured daily schedule. Include specific hours for studying, breaks, phone use, and outings.'
            },
            {
              'role': 'user',
              'content': 'Subjects: ${subjects.join(', ')}\nWeak Subjects: ${weakSubjects.join(', ')}\nPortion: $portionStr\nPersonal Plans: $personalPlans'
            }
          ]
        },
      );

      return response.data['choices'][0]['message']['content'] as String;
    } catch (e) {
      print('Grok API Error: $e');
      return 'Failed to generate schedule. Please try again.';
    }
  }

  /// Example format for interacting with Local Ollama
  Future<String> askOllama(String prompt) async {
    try {
      final response = await _dio.post(
        ollamaApiUrl,
        data: {
          'model': 'llama3.2', // use 'phi3' if preferred
          'prompt': prompt,
          'stream': false,
        },
      );
      return response.data['response'] as String;
    } catch (e) {
      print('Ollama API Error: $e');
      return 'Unable to reach local Ollama instance.';
    }
  }
}
