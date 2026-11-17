# Specifies schemas/process/user-story.ts (#1168): readUserStories, which reads
# an instance's stories.json, UserStorySchema, and danglingStoryRoles, which
# lists stories told as a role the instance's role graph does not declare.
Feature: A user story points at a declared role

  @test:schemas/process/user-story.test.ts::user_stories_point_at_their_role_(#1168)::absent_file_is_undefined,_not_an_empty_pass
  Scenario: An absent stories file reads as undefined
    Given a directory with no stories.json
    When its user stories are read
    Then the result is undefined

  @test:schemas/process/user-story.test.ts::user_stories_point_at_their_role_(#1168)::a_story_names_its_role;_`_`_keys_are_documentation
  Scenario: A story names its role, and underscore keys are documentation
    Given a stories.json with a "_comment" key and one story told as role "author"
    And a role graph declaring "author"
    When the stories are read and checked for dangling roles
    Then the story's role is "author"
    And no story dangles

  @test:schemas/process/user-story.test.ts::user_stories_point_at_their_role_(#1168)::a_story_told_as_an_undeclared_role_dangles;_one_in_another_instance_is_not_judged_here
  Scenario: A story told as an undeclared role dangles; one in another instance is not judged
    Given a story "ghost-1" told as role "ghost", and a story "elsewhere-1" told as role "ghost" in instance "someone/other"
    And a role graph declaring only "author"
    When the stories are checked for dangling roles
    Then only "ghost-1" dangles

  @test:schemas/process/user-story.test.ts::user_stories_point_at_their_role_(#1168)::a_duplicate_id_throws,_and_an_unknown_key_is_refused
  Scenario: A duplicate story id throws, and an unknown key is refused
    Given a stories.json with two stories both with id "a"
    When the stories are read
    Then it throws saying the id is declared twice
    And a story carrying an unknown key "actor" is refused by the story schema
