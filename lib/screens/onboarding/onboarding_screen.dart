import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/onboarding_provider.dart';
import '../home/home_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentIndex = 0;
  final List<String> _availableSubjects = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'English',
    'History',
    'Geography',
    'Economics',
    'Computer Science',
    'Psychology',
    'Statistics',
    'Calculus',
    'Literature',
    'Social Studies',
    'Environmental Science',
  ];

  void _nextPage() {
    if (_currentIndex < 3) {
      _pageController.animateToPage(
        _currentIndex + 1,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header with progress
            Container(
              color: Theme.of(context).primaryColor,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Study Master',
                    style: Theme.of(context).textTheme.displayLarge?.copyWith(
                          color: Colors.white,
                          fontSize: 28,
                        ),
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: (_currentIndex + 1) / 4,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                      minHeight: 4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Step ${_currentIndex + 1} of 4',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            // Page content
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                onPageChanged: (idx) => setState(() => _currentIndex = idx),
                children: [
                  _buildStep1Subjects(),
                  _buildStep2Weaknesses(),
                  _buildStep3Syllabus(),
                  _buildStep4Schedule(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // STEP 1: Ask for Subjects
  Widget _buildStep1Subjects() {
    return Consumer<OnboardingProvider>(
      builder: (context, prov, _) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'What subjects are you studying?',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Select one or more subjects to create your personalized study plan.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              Expanded(
                child: GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 1.2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _availableSubjects.length,
                  itemBuilder: (ctx, i) {
                    final subject = _availableSubjects[i];
                    final isSelected = prov.selectedSubjects.contains(subject);
                    return _buildSubjectCard(subject, isSelected, () {
                      if (isSelected) {
                        prov.selectedSubjects.remove(subject);
                      } else {
                        prov.selectedSubjects.add(subject);
                      }
                      prov.setSelectedSubjects(prov.selectedSubjects);
                    });
                  },
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: prov.selectedSubjects.isEmpty
                    ? null
                    : () {
                        prov.setSelectedSubjects(prov.selectedSubjects);
                        _nextPage();
                      },
                child: const Text('Continue'),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSubjectCard(
    String subject,
    bool isSelected,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isSelected
              ? Theme.of(context).primaryColor
              : Colors.white,
          border: Border.all(
            color: isSelected
                ? Theme.of(context).primaryColor
                : Colors.grey.shade300,
            width: 2,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isSelected ? Icons.check_circle : Icons.circle_outlined,
              color: isSelected ? Colors.white : Colors.grey,
              size: 32,
            ),
            const SizedBox(height: 8),
            Text(
              subject,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.black,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // STEP 2: Strengths & Weaknesses
  Widget _buildStep2Weaknesses() {
    return Consumer<OnboardingProvider>(
      builder: (context, prov, _) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Where do you need help?',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Select your weaker subjects so we can prioritize them in your schedule.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              Expanded(
                child: ListView.builder(
                  itemCount: prov.selectedSubjects.length,
                  itemBuilder: (ctx, i) {
                    final subject = prov.selectedSubjects[i];
                    final isWeak = prov.weakSubjects.contains(subject);
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: isWeak ? Colors.red.shade50 : Colors.white,
                        border: Border.all(
                          color: isWeak ? Colors.red.shade200 : Colors.grey.shade300,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: CheckboxListTile(
                        title: Text(
                          subject,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: isWeak ? Colors.red.shade700 : Colors.black,
                          ),
                        ),
                        subtitle: Text(
                          isWeak ? 'Marked as weak subject' : 'Tap to mark as weak',
                          style: const TextStyle(fontSize: 12),
                        ),
                        value: isWeak,
                        onChanged: (val) => prov.toggleWeakSubject(subject),
                        activeColor: Colors.red.shade600,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _nextPage,
                child: const Text('Next'),
              ),
            ],
          ),
        );
      },
    );
  }

  // STEP 3: Syllabus & Plans
  Widget _buildStep3Syllabus() {
    final portionController = TextEditingController();
    final plansController = TextEditingController();

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: ListView(
        children: [
          Text(
            'What do you need to study?',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Enter your syllabus, chapters, or topics to cover.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          TextField(
            controller: portionController,
            maxLines: 4,
            decoration: InputDecoration(
              labelText: 'Syllabus / Topics to cover',
              hintText: 'e.g., Chapters 1-5, Algebra, Newton\'s Laws...',
              suffixIcon: Padding(
                padding: const EdgeInsets.all(8.0),
                child: IconButton(
                  icon: const Icon(Icons.camera_alt),
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Camera OCR coming in Phase 3')),
                    );
                  },
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Any personal plans?',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: plansController,
            maxLines: 2,
            decoration: InputDecoration(
              labelText: 'Personal plans today',
              hintText: 'e.g., Gym at 6 PM, Meeting at 3 PM...',
            ),
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () {
              final prov = context.read<OnboardingProvider>();
              prov.setPortionAndPlans(
                portionController.text,
                plansController.text,
              );
              prov.generateFinalSchedule();
              _nextPage();
            },
            child: const Text('Generate Smart Schedule'),
          ),
        ],
      ),
    );
  }

  // STEP 4: AI Schedule Generator
  Widget _buildStep4Schedule() {
    return Consumer<OnboardingProvider>(
      builder: (context, prov, _) {
        if (prov.isGeneratingSchedule) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(
                    Theme.of(context).primaryColor,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'Generating your personalized schedule...',
                  style: Theme.of(context).textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'This might take a moment',
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Your Daily Schedule',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Your AI-powered study plan is ready',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              Expanded(
                child: SingleChildScrollView(
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade300),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Text(
                      prov.generatedSchedule.isEmpty
                          ? 'No schedule generated yet.'
                          : prov.generatedSchedule,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            height: 1.6,
                          ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const HomeScreen()),
                  );
                },
                child: const Text('Go to Dashboard'),
              ),
            ],
          ),
        );
      },
    );
  }
}
