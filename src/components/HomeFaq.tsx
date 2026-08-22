"use client";

import { Accordion, Stack, Text, Title } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { homeFaqItems } from "@/data/homeFaq";
import classes from "./HomeFaq.module.css";

export function HomeFaq() {
  const reduceMotion = useReducedMotion();

  return (
    <section className={classes.section} aria-labelledby="homepage-faq-title">
      <Stack className={classes.intro} gap="lg">
        <Text className={classes.eyebrow} fw={700} size="sm">
          FAQ
        </Text>
        <Title id="homepage-faq-title" order={2} className={classes.heading}>
          Frequently Asked Questions
        </Title>
        <Text c="dimmed" size="lg" className={classes.description}>
          Everything buyers and organizers need to know about discovering events,
          purchasing tickets, and bringing experiences to life with Mefie Tickets.
        </Text>
      </Stack>

      <Accordion
        className={classes.accordion}
        chevron={<IconPlus aria-hidden="true" size={22} stroke={1.8} />}
        chevronPosition="left"
        transitionDuration={reduceMotion ? 0 : 250}
        classNames={{
          item: classes.item,
          control: classes.control,
          label: classes.label,
          chevron: classes.chevron,
          panel: classes.panel,
        }}
      >
        {homeFaqItems.map((item) => (
          <Accordion.Item key={item.id} value={item.id}>
            <Accordion.Control>{item.question}</Accordion.Control>
            <Accordion.Panel>
              <Text c="dimmed" className={classes.answer}>
                {item.answer}
              </Text>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </section>
  );
}
