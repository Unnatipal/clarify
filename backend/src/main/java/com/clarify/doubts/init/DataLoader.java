package com.clarify.doubts.init;

import java.util.Optional;

import com.clarify.doubts.model.Doubt;
import com.clarify.doubts.model.DoubtStatus;
import com.clarify.doubts.model.Reply;
import com.clarify.doubts.model.AppUser;
import com.clarify.doubts.repo.DoubtRepository;
import com.clarify.doubts.repo.ReplyRepository;
import com.clarify.doubts.repo.AppUserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataLoader {
  @Bean
  CommandLineRunner loadData(DoubtRepository doubts, ReplyRepository replies, AppUserRepository users) {
    return args -> {
      seedDoubt(
        doubts, replies,
        "How to fix NullPointerException?",
        "I get NullPointerException when accessing a field. What is the approach to avoid it?",
        "Alice",
        new String[][] {{"Bob", "Check for null before access or use Optional where appropriate."}}
      );
      seedDoubt(
        doubts, replies,
        "Difference between List and Set?",
        "What are the main differences and when to use each?",
        "Charlie",
        null
      );
      seedDoubt(
        doubts, replies,
        "How to center a div in CSS using flexbox?",
        "I want to center a card both vertically and horizontally. What is the cleanest CSS approach?",
        "David",
        new String[][] {{"Emma", "Use display:flex; justify-content:center; align-items:center; on the parent container."}}
      );
      seedDoubt(
        doubts, replies,
        "What is the difference between var, let and const?",
        "I am confused about scope and reassignment behavior in JavaScript variables.",
        "Neha",
        new String[][] {{"Rohan", "Use let/const. var is function-scoped and can cause hoisting surprises."}}
      );
      seedDoubt(
        doubts, replies,
        "How to optimize React rendering for large lists?",
        "My page is lagging with 2000+ rows. Which techniques should I apply first?",
        "Jessica",
        null
      );
      seedDoubt(
        doubts, replies,
        "How to write binary search in Java?",
        "Can someone explain iterative binary search with time complexity?",
        "Arjun",
        new String[][] {{"Priya", "Keep low/high pointers and compare mid value each iteration. Complexity is O(log n)."}}
      );
      seedDoubt(
        doubts, replies,
        "Why am I getting CORS error from React to Spring Boot?",
        "Frontend is on port 5173 and backend on 8081. Browser blocks API calls.",
        "Mira",
        new String[][] {{"Sam", "Allow the frontend origin in backend CORS config and permit required methods/headers."}}
      );
      seedDoubt(
        doubts, replies,
        "Difference between abstract class and interface in Java?",
        "When should I use interface and when abstract class in real projects?",
        "Kunal",
        null
      );
      seedDoubt(
        doubts, replies,
        "How to reverse a linked list?",
        "Please explain iterative and recursive ways to reverse a singly linked list.",
        "Sofia",
        new String[][] {{"Ishaan", "Iterative uses prev/curr/next pointers and runs in O(n) time, O(1) space."}}
      );
      seedDoubt(
        doubts, replies,
        "What is the worst-case time complexity of quicksort?",
        "I know average is O(n log n). Why and when does it become O(n^2)?",
        "Leo",
        null
      );
      seedDoubt(
        doubts, replies,
        "How does async/await differ from promises?",
        "I can chain promises, so what extra benefit does async/await provide?",
        "Nora",
        new String[][] {{"Ava", "async/await is syntactic sugar over promises and usually makes async flow easier to read."}}
      );
      seedUserDemoDoubts(doubts, replies);
      seedUserSolvedDemoDoubts(doubts, replies);
      seedLargeDemoSet(doubts, replies);

      if (!users.existsByUsernameIgnoreCase("user")) {
        AppUser u = new AppUser();
        u.setUsername("user");
        u.setPassword("password");
        u.setRoles("USER");
        users.save(u);
      }
      if (!users.existsByUsernameIgnoreCase("admin")) {
        AppUser a = new AppUser();
        a.setUsername("admin");
        a.setPassword("admin");
        a.setRoles("ADMIN");
        users.save(a);
      }
    };
  }

  private void seedDoubt(
    DoubtRepository doubts,
    ReplyRepository replies,
    String title,
    String description,
    String authorName,
    String[][] replySeeds
  ) {
    Optional<Doubt> existing = doubts.findAll()
      .stream()
      .filter(d -> d.getTitle() != null && d.getTitle().equalsIgnoreCase(title))
      .findFirst();

    Doubt doubt = existing.orElseGet(() -> {
      Doubt created = new Doubt();
      created.setTitle(title);
      created.setDescription(description);
      created.setAuthorName(authorName);
      return doubts.save(created);
    });

    if (replySeeds != null && replySeeds.length > 0 && replies.countByDoubtId(doubt.getId()) == 0) {
      for (String[] replySeed : replySeeds) {
        Reply reply = new Reply();
        reply.setDoubt(doubt);
        reply.setAuthorName(replySeed[0]);
        reply.setMessage(replySeed[1]);
        replies.save(reply);
      }
      doubt.setStatus(DoubtStatus.SOLVED);
      doubts.save(doubt);
    }
  }

  private void seedLargeDemoSet(DoubtRepository doubts, ReplyRepository replies) {
    String[] authors = {"Aarav", "Meera", "Riya", "Kabir", "Dev", "Anika", "Tanvi", "Nikhil"};
    String[][] demos = {
      {"How to implement debounce in JavaScript?", "I want to delay API calls while typing in search input."},
      {"What is memoization in dynamic programming?", "Please explain with a simple Fibonacci example."},
      {"How to find duplicate elements in an array?", "Need both brute-force and optimized approaches."},
      {"When should I use HashMap vs TreeMap?", "I am confused about ordering and performance trade-offs."},
      {"What is the difference between process and thread?", "Need a beginner-friendly explanation with examples."},
      {"How to create a REST API with Spring Boot?", "What are the minimum annotations and project structure?"},
      {"Why does useEffect run twice in development?", "I am seeing duplicate API calls in React StrictMode."},
      {"How to use git rebase safely?", "I want clean commit history without losing changes."},
      {"What is normalization in databases?", "Please explain 1NF, 2NF and 3NF with examples."},
      {"How to handle file uploads in React + Spring?", "Best way to upload images with multipart/form-data?"},
      {"Difference between SQL INNER JOIN and LEFT JOIN?", "Need query examples for both."},
      {"How to validate forms in React?", "Should I use custom validation or a library like Formik?"},
      {"What is lazy loading in React?", "How can I split code by routes and improve performance?"},
      {"How to prevent SQL injection?", "What secure coding practices should I follow?"},
      {"How to sort objects by date in JavaScript?", "My date values are strings and sorting is wrong."},
      {"What are Java Streams and when to use them?", "Need simple examples compared to loops."},
      {"How to implement pagination in Spring Boot?", "Server-side pagination for large datasets."},
      {"What is JWT authentication flow?", "How login, token issue, and token validation work?"},
      {"How to write unit tests for service layer?", "Need JUnit examples with mocks."},
      {"How to optimize MySQL query performance?", "Slow queries on indexed columns sometimes."},
      {"What is event bubbling in JavaScript?", "How does stopPropagation change behavior?"},
      {"How to deploy React + Spring app?", "Looking for simple production deployment steps."},
      {"What is recursion and how to avoid stack overflow?", "Need practical tips and examples."},
      {"How to create responsive layouts with CSS Grid?", "I struggle with mobile breakpoints."},
      {"Difference between composition and inheritance?", "When is composition preferred in OOP design?"},
      {"How to handle 404 routes in React Router?", "Need a proper not-found page setup."},
      {"How to parse JSON safely in JavaScript?", "I get crashes when API returns invalid JSON."},
      {"How to model many-to-many relation in JPA?", "Need entities for students and courses."},
      {"How to cache API responses in frontend?", "Any pattern for reducing duplicate network calls?"},
      {"How to secure passwords in backend?", "What hashing algorithm and practices are recommended?"},
      {"What is Big-O notation?", "How to quickly estimate complexity of loops and recursion?"},
      {"How to upload profile picture and preview it?", "Need frontend image preview before save."}
    };

    for (int i = 0; i < demos.length; i++) {
      String title = demos[i][0];
      String description = demos[i][1];
      String author = authors[i % authors.length];

      // Alternate between answered and open so filters have rich demo coverage.
      String[][] replySeeds = (i % 2 == 0)
        ? new String[][] {
          {"Mentor" + ((i % 6) + 1), "Start with a small reproducible example and apply the recommended pattern step by step."}
        }
        : null;

      seedDoubt(doubts, replies, title, description, author, replySeeds);
    }
  }

  private void seedUserDemoDoubts(DoubtRepository doubts, ReplyRepository replies) {
    seedDoubt(
      doubts, replies,
      "How to debug 401 Unauthorized in Spring Security?",
      "My API works in Postman but frontend gets 401. Which checks should I perform?",
      "user",
      new String[][] {
        {"MentorRaj", "Verify the Authorization header, endpoint permission rules, and whether credentials are sent from browser requests."}
      }
    );
    seedDoubt(
      doubts, replies,
      "Can someone explain Java Streams map vs flatMap?",
      "I understand map on lists, but I get confused when nested collections are involved.",
      "user",
      new String[][] {
        {"Neha", "Use map when each input maps to one output, flatMap when each input maps to a stream/collection you want flattened."}
      }
    );
    seedDoubt(
      doubts, replies,
      "How should I prepare DSA daily in 60 minutes?",
      "Need a practical study routine for consistency and revision.",
      "user",
      null
    );
    seedDoubt(
      doubts, replies,
      "Why is React state update not reflecting immediately?",
      "I call setState and log the value, but old value appears. Is this batching?",
      "user",
      new String[][] {
        {"GuideBot", "State updates are async and batched. Read updated value in effects/render, not right after setState in same tick."}
      }
    );
    seedDoubt(
      doubts, replies,
      "How to write cleaner SQL joins for reports?",
      "My query has many joins and duplicates rows. Need debugging tips.",
      "user",
      null
    );
  }

  private void seedUserSolvedDemoDoubts(DoubtRepository doubts, ReplyRepository replies) {
    seedDoubt(
      doubts, replies,
      "How to use position: sticky properly?",
      "Sticky header does not stick when scrolling inside container.",
      "Naina",
      new String[][] {
        {"user", "Sticky works when parent has scrollable height and no overflow:hidden clipping the sticky element."}
      }
    );
    seedDoubt(
      doubts, replies,
      "What is the difference between stack and queue?",
      "Need a simple real-world explanation for interview prep.",
      "Ritesh",
      new String[][] {
        {"user", "Stack is LIFO like plates, queue is FIFO like a line at ticket counter."}
      }
    );
    seedDoubt(
      doubts, replies,
      "How to host React app on Netlify?",
      "Build succeeds locally but deploy output path seems wrong.",
      "Pooja",
      new String[][] {
        {"user", "Set build command to npm run build and publish directory to dist for Vite projects."}
      }
    );
    seedDoubt(
      doubts, replies,
      "How to improve coding speed in contests?",
      "I know concepts but I am too slow during implementation.",
      "Ibrahim",
      new String[][] {
        {"user", "Practice templates, dry-run before coding, and focus on fewer bugs instead of typing faster blindly."}
      }
    );
    seedDoubt(
      doubts, replies,
      "How does JVM memory model work?",
      "Need a beginner explanation of heap, stack, and metaspace.",
      "Kriti",
      new String[][] {
        {"user", "Objects live in heap, method frames/local variables in stack, class metadata in metaspace."}
      }
    );
  }
}
