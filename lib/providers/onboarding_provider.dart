import 'package:flutter/material.dart';
import '../services/ai_service.dart';

class OnboardingProvider extends ChangeNotifier {
  final AIService _aiService = AIService();

  // Step 1 Data - Direct subjects input
  List<String> selectedSubjects = [];

  // Step 2 Data
  Map<String, String> marks = {};
  List<String> weakSubjects = [];

  // Step 3 Data
  String portion = '';
  String personalPlans = '';

  // Step 4 Data
  String generatedSchedule = '';
  bool isGeneratingSchedule = false;

  void setSelectedSubjects(List<String> subjects) {
    selectedSubjects = subjects;
    // Initialize marks map empty per subject
    for (var sub in selectedSubjects) {
      marks[sub] = '';
    }
    notifyListeners();
  }

  void toggleWeakSubject(String subject) {
    if (weakSubjects.contains(subject)) {
      weakSubjects.remove(subject);
    } else {
      weakSubjects.add(subject);
    }
    notifyListeners();
  }

  void updateMark(String subject, String mark) {
    marks[subject] = mark;
    notifyListeners();
  }

  void setPortionAndPlans(String port, String plans) {
    portion = port;
    personalPlans = plans;
    notifyListeners();
  }

  Future<void> generateFinalSchedule() async {
    isGeneratingSchedule = true;
    notifyListeners();

    generatedSchedule = await _aiService.generateSchedule(
      subjects: selectedSubjects,
      weakSubjects: weakSubjects,
      portionStr: portion,
      personalPlans: personalPlans,
    );

    isGeneratingSchedule = false;
    notifyListeners();
  }
}
